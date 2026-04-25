var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// ../../.wrangler/tmp/pages-MjZ018/functionsWorker-0.4456670521216872.mjs
var __defProp2 = Object.defineProperty;
var __name2 = /* @__PURE__ */ __name((target, value) => __defProp2(target, "name", { value, configurable: true }), "__name");
var SYSTEM_RULES = `
You are a professional web agency strategist and conversion-focused brand writer.

==============================
HARD OUTPUT CONTRACT (MUST FOLLOW)
==============================
1) Return ONLY a single JSON object.
2) NO markdown. NO commentary. NO code fences.
3) Use ONLY schema-approved keys and EXACT nesting (see below).
4) Include ALL required top-level keys every time:
   intelligence, strategy, settings, brand, hero, about, features, contact
5) Optional keys are allowed ONLY if relevant AND schema-correct:
   trustbar, gallery, events, service_area, processSteps, testimonials, comparison, investment, faqs
6) If the client is vague, infer premium, plausible defaults that are internally consistent.

==============================
SCHEMA-CORRECT KEYS (DO NOT DEVIATE)
==============================
\u2705 Use these exact key paths:
- intelligence.industry
- intelligence.target_persona
- intelligence.tone_of_voice

- strategy.show_trustbar
- strategy.show_about
- strategy.show_features
- strategy.show_events
- strategy.show_process
- strategy.show_testimonials
- strategy.show_comparison
- strategy.show_gallery
- strategy.show_investment
- strategy.show_faqs
- strategy.show_service_area

- settings.vibe
- settings.menu[] = { label, path }
- settings.cta_text
- settings.cta_link
- settings.cta_type  ("anchor" | "external")
- settings.secondary_cta_text (optional string)
- settings.secondary_cta_link (optional string)

- brand.name
- brand.slug
- brand.tagline
- brand.email
- brand.phone (optional)
- brand.office_address (optional)
- brand.objection_handle (optional)

- hero.headline
- hero.subtext
- hero.image.alt
- hero.image.image_search_query

- about.story_text
- about.founder_note
- about.years_experience

- features[] = { title, description, icon_slug }

- contact.headline
- contact.subheadline
- contact.email_recipient
- contact.button_text
- contact.email (optional)
- contact.phone (optional)
- contact.office_address (optional)

\u2705 If you include trustbar:
- trustbar.enabled (boolean)
- trustbar.headline (string)
- trustbar.items[] = { icon, label, sublabel? }

\u2705 If you include gallery:
- gallery.enabled (boolean)
- gallery.title (string)
- gallery.layout ( "grid" | "masonry" | "bento" | null )
- gallery.show_titles (boolean)
- gallery.computed_count (number|null)
- gallery.computed_layout ("grid"|"masonry"|"bento"|null)
- gallery.items[] = { title, image_search_query, caption?, tag? }

\u2705 If you include events:
- events[] = { date, venue, location, link }

\u2705 If you include service_area:
- service_area.main_city
- service_area.surrounding_cities[]
- service_area.travel_note (optional)
- service_area.cta_text (optional)
- service_area.cta_link (optional)
- service_area.map_search_query (optional)

\u2705 If you include processSteps:
- processSteps[] = { title, description }

\u2705 If you include testimonials:
- testimonials[] = { quote, author, role }

\u2705 If you include comparison:
- comparison.title
- comparison.items[] = { label, us, them }

\u2705 If you include investment:
- investment[] = { tier_name, price, popular?, features[] }

\u2705 If you include faqs:
- faqs[] = { question, answer }

==============================
FORBIDDEN / LEGACY KEYS (NEVER OUTPUT)
==============================
Do NOT output any of these (or similar) keys:
- menu_links
- background_image_search_query
- hero.background_image_search_query
- gallery.images
- trustbar.points
- settings.gallery (nested gallery config inside settings)
- contact.form_fields
- contact.submit_text
- any extra wrapper like { ok: true, ... }
Return ONLY the business JSON object.

==============================
SECTION MINIMUM CONTENT RULES
==============================
You MUST ensure minimum content exists for any section you enable in strategy.
If you set a strategy flag to true, you must populate the matching data with real content.

A) Always required (always produce):
- intelligence: all fields non-empty
- strategy: all booleans present
- settings: vibe, menu, cta_text, cta_link, cta_type present
- brand: name, slug, tagline, email present
- hero: headline, subtext, image.alt, image.image_search_query present
- about: story_text, founder_note, years_experience present
- features: 3\u20136 items, each with title/description/icon_slug
- contact: headline, subheadline, email_recipient, button_text present

B) Conditional sections (only include if enabled AND you can populate):
- strategy.show_trustbar = true  => include trustbar with enabled=true and 3\u20136 items (labels must not be empty)
- strategy.show_gallery  = true  => include gallery with enabled=true and:
    - computed_count: 5/6/9 based on inference rules (below)
    - computed_layout: bento/grid/masonry based on inference rules (below)
    - items count MUST equal computed_count
    - every item MUST have image_search_query (4\u20138 words)
- strategy.show_events = true     => include events with 3\u201310 items (if you cannot provide 3+, set show_events=false)
- strategy.show_process = true    => include processSteps with 3\u20135 steps (if you cannot provide 3+, set show_process=false)
- strategy.show_testimonials=true => include testimonials with 3\u20136 items (if you cannot provide 3+, set show_testimonials=false)
- strategy.show_comparison=true   => include comparison with 3\u20136 rows (if you cannot provide 3+, set show_comparison=false)
- strategy.show_investment=true   => include investment with 2\u20134 tiers (if you cannot provide 2+, set show_investment=false)
- strategy.show_faqs=true         => include faqs with 3\u20136 items (if you cannot provide 3+, set show_faqs=false)
- strategy.show_service_area=true => include service_area object with:
    - main_city (non-empty)
    - surrounding_cities array (4\u20138 items preferred)
  (If you cannot infer location, set show_service_area=false)

==============================
MENU RULE (CRITICAL): MENU ONLY FOR RENDERABLE SECTIONS
==============================
This is mandatory:
- settings.menu MUST include ONLY anchors for sections that will actually render.
- Always include: #home and #contact
- Include an anchor ONLY if its section is enabled AND will have content:

Renderable anchor mapping:
- #about         => include ONLY if strategy.show_about is true
- #features      => include ONLY if strategy.show_features is true AND features has 3+ items
- #events        => include ONLY if strategy.show_events is true AND events has 3+ items
- #process       => include ONLY if strategy.show_process is true AND processSteps has 3+ items
- #testimonials  => include ONLY if strategy.show_testimonials is true AND testimonials has 3+ items
- #comparison    => include ONLY if strategy.show_comparison is true AND comparison.items has 3+ rows
- #gallery       => include ONLY if strategy.show_gallery is true AND gallery.items length >= 1
- #investment    => include ONLY if strategy.show_investment is true AND investment length >= 2
- #faqs          => include ONLY if strategy.show_faqs is true AND faqs length >= 3
- #service-area  => include ONLY if strategy.show_service_area is true AND service_area.main_city exists
- #contact       => always include

Allowed menu paths ONLY:
#home #about #features #events #process #testimonials #comparison #gallery #investment #faqs #service-area #contact

Menu formatting:
- settings.menu is 5\u20139 items preferred (include only what is renderable)
- Each item: { "label": "Title Case", "path": "#anchor" }

==============================
CTA RULES
==============================
- settings.cta_link should usually be "#contact" (single-page).
- settings.cta_type must be:
  - "anchor" if cta_link starts with "#"
  - "external" if cta_link starts with "http://" or "https://"
- Keep CTA copy specific and conversion-focused.

==============================
IMAGE SEARCH QUERY RULES (CRITICAL)
==============================
- hero.image.image_search_query is REQUIRED every time.
- If gallery is enabled, EVERY gallery.items[i].image_search_query is REQUIRED.
Query format:
- 4\u20138 words.
- Broad + visual: "{subject} {action} {context}"
- Avoid locations (no city/state/country).
- Avoid overly specific brand/model names.
Examples (auto detailing):
- "car polishing glossy paint"
- "interior cleaning leather seats"
- "foam wash driveway"
- "detailer working on SUV"

==============================
GALLERY INFERENCE (layout + count)
==============================
Choose computed_layout + computed_count using industry/vibe positioning:
- Luxury/Boutique (watches, jewelry, high-end): computed_layout="bento", computed_count=5
- Service/Trades (detailing, plumbing, HVAC, contractors): computed_layout="grid", computed_count=6
- Creative/Studio (photo, art, design): computed_layout="masonry", computed_count=9
- Otherwise: computed_layout="grid", computed_count=6

If strategy.show_gallery is true:
- gallery.enabled must be true
- gallery.items length MUST equal gallery.computed_count

==============================
VIBE SELECTION
==============================
Pick the SINGLE best settings.vibe based on intelligence.industry and positioning (see VIBE_GUIDE).
settings.vibe MUST be exactly one of:
"Midnight Tech" | "Zenith Earth" | "Vintage Boutique" | "Rugged Industrial" |
"Modern Minimal" | "Luxury Noir" | "Legacy Professional" | "Solar Flare"

==============================
ICON RULES
==============================
- features[].icon_slug MUST be from ICON_LIST (or a short emoji fallback).
- trustbar.items[].icon MUST be from ICON_LIST (or a short emoji fallback).

==============================
FINAL CHECK BEFORE OUTPUTTING JSON
==============================
Before you output:
1) Confirm all required top-level keys exist.
2) Confirm hero.image.image_search_query exists (4\u20138 words).
3) If gallery enabled, confirm every gallery item has image_search_query (4\u20138 words).
4) Confirm settings.menu contains ONLY renderable section anchors.
5) Confirm no forbidden keys exist.
Return the JSON object only.
`;
var VIBE_GUIDE = `
Available Vibes:
- "Midnight Tech": High-contrast, dark, neon accents.
- "Zenith Earth": Organic, light, airy, nature-focused.
- "Vintage Boutique": Warm tones, serif fonts, elegant.
- "Rugged Industrial": Gritty, bold, high-durability feel.
- "Modern Minimal": Clean, professional, corporate.
- "Luxury Noir": Deep blacks, gold/silver accents, premium.
- "Legacy Professional": Trustworthy, blue/white, traditional.
- "Solar Flare": Vibrant, energetic, experimental.

Vibe selection rule:
Pick the SINGLE best vibe based on intelligence.industry and positioning.
`;
var ICON_LIST = `zap, cpu, layers, rocket, leaf, sprout, sun, scissors, truck, hammer, wrench, trash, sparkles, heart, award, users, map, shield, star, check, coins, briefcase, clock, phone`;
async function onRequestPost({ request, env }) {
  try {
    const body = await request.json();
    const businessName = String(body.businessName || "").trim();
    const story = String(body.story || "").trim();
    const clientEmail = String(body.clientEmail || "").trim();
    if (!businessName || !story) {
      return json({ ok: false, error: "Missing businessName or story" }, 400);
    }
    const raw = await callAI_({ businessName, story, clientEmail }, env);
    let data = normalizeToMasterSchema_(raw, { businessName, story, clientEmail });
    data = ensureInspirationQueries_(data);
    const errors = validateMasterContract_(data);
    if (errors.length) {
      return json(
        {
          ok: false,
          error: "Schema contract failed",
          errors,
          hint: "Fix prompt/normalizer so output matches master schema paths (hero.image.image_search_query, gallery.items[], settings.cta_type, features[], etc)."
        },
        422
      );
    }
    const clientSlug = normalizeSlug_(data?.brand?.slug || businessName);
    data.brand.slug = clientSlug;
    return json({ ok: true, client_slug: clientSlug, business_json: data }, 200);
  } catch (err) {
    return json({ ok: false, error: String(err?.message || err) }, 500);
  }
}
__name(onRequestPost, "onRequestPost");
__name2(onRequestPost, "onRequestPost");
async function callAI_({ businessName, story, clientEmail }, env) {
  if (!env.OPENAI_API_KEY) throw new Error("Missing env.OPENAI_API_KEY");
  const system = [
    SYSTEM_RULES,
    VIBE_GUIDE,
    `ICON_LIST (use only these tokens for icon fields, or short emoji): ${ICON_LIST}`,
    `OUTPUT RULES:
- Return ONLY valid JSON (no markdown, no commentary).
- Must follow the master schema key paths exactly.
- All menu links must be # anchors unless truly external.
- hero.image.image_search_query REQUIRED (4\u20138 words).
- If strategy.show_gallery is true: gallery.enabled=true and gallery.items[] with image_search_query for every item.`
  ].join("\n\n");
  const user = [
    `Business Name: ${businessName}`,
    `Client Email (optional): ${clientEmail || ""}`,
    ``,
    `Story:`,
    story
  ].join("\n");
  const res = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.OPENAI_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: env.OPENAI_MODEL || "gpt-4.1-mini",
      input: [
        { role: "system", content: system },
        { role: "user", content: user }
      ],
      text: { format: { type: "json_object" } }
    })
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`OpenAI error (${res.status}): ${t}`);
  }
  const data = await res.json();
  const text = data?.output?.[0]?.content?.find((c) => c.type === "output_text")?.text ?? data?.output_text ?? null;
  if (!text) throw new Error("OpenAI returned no text output");
  try {
    return JSON.parse(text);
  } catch {
    throw new Error("OpenAI did not return valid JSON");
  }
}
__name(callAI_, "callAI_");
__name2(callAI_, "callAI_");
function normalizeToMasterSchema_(raw, ctx) {
  const r = deepClone_(raw || {});
  const out = {};
  out.intelligence = {
    industry: r.intelligence?.industry || r.brand?.industry || r.industry || "Service business",
    target_persona: r.intelligence?.target_persona || r.intelligence?.target_audience || r.target_persona || "Customers seeking a premium provider",
    tone_of_voice: r.intelligence?.tone_of_voice || r.tone_of_voice || r.intelligence?.market_position || "Premium, confident, trustworthy"
  };
  const s = r.strategy || {};
  out.strategy = {
    show_trustbar: bool_(s.show_trustbar, true),
    show_about: bool_(s.show_about, true),
    show_features: bool_(s.show_features, true),
    show_events: bool_(s.show_events, false),
    show_process: bool_(s.show_process, false),
    show_testimonials: bool_(s.show_testimonials, false),
    show_comparison: bool_(s.show_comparison, false),
    show_gallery: bool_(s.show_gallery, true),
    show_investment: bool_(s.show_investment, false),
    show_faqs: bool_(s.show_faqs, false),
    show_service_area: bool_(s.show_service_area, false)
  };
  const vibe = r.settings?.vibe || r.strategy?.vibe || "Modern Minimal";
  const ctaLink = r.settings?.cta_link || r.strategy?.cta?.href || "#contact";
  out.settings = {
    vibe,
    menu: normalizeMenu_(r.settings?.menu || r.strategy?.menu_links || r.menu || null),
    cta_text: r.settings?.cta_text || r.strategy?.cta?.text || "Get Started",
    cta_link: ctaLink,
    cta_type: inferCtaType_(r.settings?.cta_type, ctaLink),
    secondary_cta_text: r.settings?.secondary_cta_text || "",
    secondary_cta_link: r.settings?.secondary_cta_link || ""
  };
  out.brand = {
    name: r.brand?.name || ctx.businessName,
    slug: r.brand?.slug || normalizeSlug_(ctx.businessName),
    tagline: r.brand?.tagline || r.brand?.positioning || "Built for quality and trust.",
    email: r.brand?.email || ctx.clientEmail || "contact@example.com",
    phone: r.brand?.phone || "",
    office_address: r.brand?.office_address || "",
    objection_handle: r.brand?.objection_handle || ""
  };
  const heroQuery = r.hero?.image?.image_search_query || r.hero?.background_image_search_query || r.hero?.image_search_query || null;
  out.hero = {
    headline: r.hero?.headline || r.hero?.title || `Welcome to ${out.brand.name}`,
    subtext: r.hero?.subtext || r.hero?.subheadline || r.hero?.subtitle || "A premium experience built around your needs.",
    image: {
      alt: r.hero?.image?.alt || r.hero?.image_alt || `${out.intelligence.industry} hero image`,
      image_search_query: heroQuery || ""
    }
  };
  out.about = {
    story_text: r.about?.story_text || r.about?.content || r.about?.story || ctx.story || "",
    founder_note: r.about?.founder_note || "Crafted with care and pride.",
    years_experience: r.about?.years_experience || "10+"
  };
  if (r.trustbar) {
    out.trustbar = normalizeTrustbar_(r.trustbar);
  } else if (out.strategy.show_trustbar) {
    out.trustbar = {
      enabled: true,
      headline: "Why Choose Us",
      items: [
        { icon: "award", label: "Premium quality" },
        { icon: "shield", label: "Trusted and reliable" },
        { icon: "clock", label: "Fast response" }
      ]
    };
  }
  out.features = normalizeFeatures_(r.features);
  out.gallery = normalizeGallery_(r.gallery, out.strategy.show_gallery, out.intelligence?.industry, out.settings?.vibe);
  out.contact = {
    headline: r.contact?.headline || "Get in Touch",
    subheadline: r.contact?.subheadline || r.contact?.content || "Tell us what you need and we\u2019ll respond quickly.",
    email: r.contact?.email || out.brand.email,
    phone: r.contact?.phone || out.brand.phone,
    email_recipient: r.contact?.email_recipient || out.brand.email,
    button_text: r.contact?.button_text || r.contact?.submit_text || "Send Message",
    office_address: r.contact?.office_address || out.brand.office_address
  };
  return out;
}
__name(normalizeToMasterSchema_, "normalizeToMasterSchema_");
__name2(normalizeToMasterSchema_, "normalizeToMasterSchema_");
function ensureInspirationQueries_(data) {
  if (!data?.hero) data.hero = {};
  if (!data.hero.image) data.hero.image = {};
  data.hero.image.image_search_query = String(data.hero.image.image_search_query || "").trim();
  if (data?.strategy?.show_gallery) {
    data.gallery = data.gallery || { enabled: true, items: [] };
    data.gallery.enabled = true;
    if (!Array.isArray(data.gallery.items)) data.gallery.items = [];
    const count = Number(
      data.gallery.computed_count || data.gallery.items.length || 6
    );
    while (data.gallery.items.length < count) {
      data.gallery.items.push({
        title: `Project ${data.gallery.items.length + 1}`,
        image_search_query: ""
      });
    }
    data.gallery.items = data.gallery.items.map((it, i) => ({
      ...it,
      title: String(it?.title || `Project ${i + 1}`),
      image_search_query: String(it?.image_search_query || "").trim()
    }));
    if (!data.gallery.image_source || typeof data.gallery.image_source !== "object") {
      data.gallery.image_source = {};
    }
    data.gallery.image_source.image_search_query = String(
      data.gallery.image_source.image_search_query || ""
    ).trim();
  } else {
    if (data.gallery) data.gallery.enabled = Boolean(data.gallery.enabled);
  }
  return data;
}
__name(ensureInspirationQueries_, "ensureInspirationQueries_");
__name2(ensureInspirationQueries_, "ensureInspirationQueries_");
function validateMasterContract_(data) {
  const errors = [];
  const reqTop = ["intelligence", "strategy", "settings", "brand", "hero", "about", "features", "contact"];
  for (const k of reqTop) if (!data?.[k]) errors.push(`Missing top-level "${k}"`);
  for (const k of ["industry", "target_persona", "tone_of_voice"]) {
    if (!data?.intelligence?.[k]) errors.push(`Missing intelligence.${k}`);
  }
  const vibes = /* @__PURE__ */ new Set([
    "Midnight Tech",
    "Zenith Earth",
    "Vintage Boutique",
    "Rugged Industrial",
    "Modern Minimal",
    "Luxury Noir",
    "Legacy Professional",
    "Solar Flare"
  ]);
  if (!vibes.has(data?.settings?.vibe)) errors.push("settings.vibe must be one of allowed enum values");
  for (const k of ["cta_text", "cta_link", "cta_type"]) {
    if (!data?.settings?.[k]) errors.push(`Missing settings.${k}`);
  }
  if (!Array.isArray(data?.settings?.menu) || data.settings.menu.length === 0) {
    errors.push("settings.menu must be a non-empty array");
  } else {
    const allowedAnchors = /* @__PURE__ */ new Set([
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
    ]);
    data.settings.menu.forEach((m, i) => {
      if (!m?.label) errors.push(`settings.menu[${i}].label missing`);
      if (!allowedAnchors.has(m?.path)) errors.push(`settings.menu[${i}].path invalid: ${m?.path}`);
    });
  }
  for (const k of ["name", "tagline", "email"]) {
    if (!data?.brand?.[k]) errors.push(`Missing brand.${k}`);
  }
  for (const k of ["headline", "subtext"]) {
    if (!data?.hero?.[k]) errors.push(`Missing hero.${k}`);
  }
  if (!data?.hero?.image?.alt) errors.push("Missing hero.image.alt");
  if (!data?.hero?.image?.image_search_query) errors.push("Missing hero.image.image_search_query");
  for (const k of ["story_text", "founder_note", "years_experience"]) {
    if (!data?.about?.[k]) errors.push(`Missing about.${k}`);
  }
  if (!Array.isArray(data?.features) || data.features.length < 3) {
    errors.push("features must be an array with at least 3 items");
  } else {
    data.features.forEach((f, i) => {
      for (const k of ["title", "description", "icon_slug"]) {
        if (!f?.[k]) errors.push(`features[${i}].${k} missing`);
      }
    });
  }
  for (const k of ["headline", "subheadline", "email_recipient", "button_text"]) {
    if (!data?.contact?.[k]) errors.push(`Missing contact.${k}`);
  }
  if (data?.strategy?.show_gallery) {
    if (!data?.gallery?.enabled) errors.push("strategy.show_gallery=true but gallery.enabled is not true");
    if (!Array.isArray(data?.gallery?.items) || data.gallery.items.length === 0) {
      errors.push("gallery.items must be a non-empty array when gallery enabled");
    } else {
      data.gallery.items.forEach((it, i) => {
        if (!it?.title) errors.push(`gallery.items[${i}].title missing`);
        if (!it?.image_search_query) errors.push(`gallery.items[${i}].image_search_query missing`);
      });
    }
  }
  if (data?.trustbar) {
    if (typeof data.trustbar.enabled !== "boolean") errors.push("trustbar.enabled must be boolean");
    if (!Array.isArray(data.trustbar.items) || data.trustbar.items.length < 2) {
      errors.push("trustbar.items must have 2+ items when trustbar exists");
    }
  }
  return errors;
}
__name(validateMasterContract_, "validateMasterContract_");
__name2(validateMasterContract_, "validateMasterContract_");
function normalizeGallery_(g, showGallery, industry, vibe) {
  const gg = g || {};
  const enabled = Boolean(gg.enabled ?? showGallery);
  let items = gg.items;
  if (!Array.isArray(items) && Array.isArray(gg.images)) {
    items = gg.images.map((im, i) => ({
      title: im.title || im.alt || `Project ${i + 1}`,
      image_search_query: im.image_search_query || ""
    }));
  }
  if (!Array.isArray(items)) items = [];
  const ind = String(industry || "").toLowerCase();
  const isLuxury = ind.includes("watch") || ind.includes("jewelry") || String(vibe || "") === "Luxury Noir";
  const isCreative = ind.includes("photo") || ind.includes("studio") || ind.includes("art");
  const isTrades = ind.includes("detailing") || ind.includes("plumbing") || ind.includes("construction") || ind.includes("trades") || ind.includes("service");
  const computed_layout = gg.computed_layout || (isLuxury ? "bento" : isCreative ? "masonry" : isTrades ? "grid" : "grid");
  const computed_count = gg.computed_count || items.length || (isLuxury ? 5 : isCreative ? 9 : isTrades ? 6 : 6);
  return {
    enabled,
    title: gg.title || "Gallery",
    layout: gg.layout ?? null,
    show_titles: gg.show_titles ?? true,
    image_source: gg.image_source || {
      image_search_query: ""
    },
    computed_count: enabled ? computed_count : gg.computed_count ?? null,
    computed_layout: enabled ? computed_layout : gg.computed_layout ?? null,
    items
  };
}
__name(normalizeGallery_, "normalizeGallery_");
__name2(normalizeGallery_, "normalizeGallery_");
function normalizeFeatures_(f) {
  if (Array.isArray(f) && f.length) {
    return f.map((x) => ({
      title: String(x.title || "Feature"),
      description: String(x.description || ""),
      icon_slug: String(x.icon_slug || x.icon || "sparkles")
    }));
  }
  return [
    { title: "Premium Quality", description: "Crafted for performance and trust.", icon_slug: "award" },
    { title: "Fast Response", description: "Clear communication and quick turnaround.", icon_slug: "clock" },
    { title: "Trusted Service", description: "Reliable from start to finish.", icon_slug: "shield" }
  ];
}
__name(normalizeFeatures_, "normalizeFeatures_");
__name2(normalizeFeatures_, "normalizeFeatures_");
function normalizeTrustbar_(t) {
  const tt = t || {};
  let items = tt.items;
  if (!Array.isArray(items) && Array.isArray(tt.points)) {
    items = tt.points.map((p) => ({ icon: p.icon || "check", label: p.text || "" }));
  }
  if (!Array.isArray(items)) items = [];
  return {
    enabled: Boolean(tt.enabled ?? true),
    headline: tt.headline || "Why Choose Us",
    items: items.slice(0, 8).map((it) => ({
      icon: it.icon || "check",
      label: it.label || it.text || "",
      sublabel: it.sublabel || ""
    }))
  };
}
__name(normalizeTrustbar_, "normalizeTrustbar_");
__name2(normalizeTrustbar_, "normalizeTrustbar_");
function normalizeMenu_(menuLike) {
  const fallback = [
    { label: "Home", path: "#home" },
    { label: "About", path: "#about" },
    { label: "Features", path: "#features" },
    { label: "Gallery", path: "#gallery" },
    { label: "Contact", path: "#contact" }
  ];
  if (!Array.isArray(menuLike) || !menuLike.length) return fallback;
  const allowed = /* @__PURE__ */ new Set([
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
  ]);
  const mapped = menuLike.map((m) => ({
    label: String(m?.label || m?.name || "Link").trim() || "Link",
    path: String(m?.path || m?.href || "#contact").trim() || "#contact"
  }));
  return mapped.map((m) => ({
    label: m.label,
    path: allowed.has(m.path) ? m.path : "#contact"
  }));
}
__name(normalizeMenu_, "normalizeMenu_");
__name2(normalizeMenu_, "normalizeMenu_");
function inferCtaType_(ctaType, link) {
  if (ctaType === "anchor" || ctaType === "external") return ctaType;
  return String(link || "").startsWith("#") ? "anchor" : "external";
}
__name(inferCtaType_, "inferCtaType_");
__name2(inferCtaType_, "inferCtaType_");
function bool_(v, dflt) {
  return typeof v === "boolean" ? v : dflt;
}
__name(bool_, "bool_");
__name2(bool_, "bool_");
function normalizeSlug_(s) {
  return String(s || "").toLowerCase().replace(/'/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}
__name(normalizeSlug_, "normalizeSlug_");
__name2(normalizeSlug_, "normalizeSlug_");
function deepClone_(x) {
  return JSON.parse(JSON.stringify(x));
}
__name(deepClone_, "deepClone_");
__name2(deepClone_, "deepClone_");
function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" }
  });
}
__name(json, "json");
__name2(json, "json");
async function onRequestGet(context) {
  try {
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const response = {
      ok: true,
      service: "siteforge-intake",
      version: "1.0",
      timestamp: now,
      region: context?.cf?.colo || "unknown"
    };
    return new Response(JSON.stringify(response, null, 2), {
      status: 200,
      headers: {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "no-store"
      }
    });
  } catch (err) {
    return new Response(JSON.stringify({
      ok: false,
      error: String(err)
    }), {
      status: 500,
      headers: { "content-type": "application/json" }
    });
  }
}
__name(onRequestGet, "onRequestGet");
__name2(onRequestGet, "onRequestGet");
var SCHEMA_VIBES = [
  "Midnight Tech",
  "Zenith Earth",
  "Vintage Boutique",
  "Rugged Industrial",
  "Modern Minimal",
  "Luxury Noir",
  "Legacy Professional",
  "Solar Flare"
];
var STOPWORDS = /* @__PURE__ */ new Set([
  "a",
  "an",
  "the",
  "and",
  "or",
  "for",
  "with",
  "from",
  "that",
  "this",
  "your",
  "our",
  "are",
  "was",
  "were",
  "been",
  "being",
  "have",
  "has",
  "had",
  "do",
  "does",
  "did",
  "will",
  "would",
  "could",
  "should",
  "may",
  "might",
  "must",
  "shall",
  "can",
  "need",
  "their",
  "they",
  "them",
  "its",
  "it",
  "we",
  "you",
  "i",
  "he",
  "she",
  "his",
  "her",
  "who",
  "whom",
  "which",
  "what",
  "when",
  "where",
  "why",
  "how",
  "all",
  "each",
  "every",
  "both",
  "few",
  "more",
  "most",
  "other",
  "some",
  "such",
  "no",
  "nor",
  "not",
  "only",
  "own",
  "same",
  "so",
  "than",
  "too",
  "very",
  "just",
  "also",
  "into",
  "about",
  "after",
  "before",
  "between",
  "through",
  "during",
  "under",
  "over",
  "again",
  "then",
  "here",
  "there",
  "any",
  "out",
  "off",
  "up",
  "down",
  "per",
  "via",
  "based",
  "local",
  "best",
  "top",
  "full",
  "new",
  "get",
  "help",
  "make",
  "work",
  "services",
  "service",
  "business",
  "company",
  // Strategy / conversion labels — not useful visual search tokens
  "testimonial",
  "testimonials",
  "customer",
  "customers",
  "pricing",
  "reviews",
  "review",
  "engagement",
  "structure",
  "clear",
  "quote",
  "quotes",
  "conversion",
  "faqs"
]);
var VIBE_STYLE_RULES = [
  { re: /\b(luxury|noir|upscale|opulent|black\s*tie|high\s*end)\b/i, vibe: "Luxury Noir" },
  { re: /\b(zen|calm|earth|organic|natural|grounded|serene)\b/i, vibe: "Zenith Earth" },
  { re: /\b(heritage|legacy|timeless|classic|established|institutional)\b/i, vibe: "Legacy Professional" },
  { re: /\b(industrial|rugged|forge|steel|workshop|grit)\b/i, vibe: "Rugged Industrial" },
  { re: /\b(solar|flare|warm\s*gold|sunlit|radiant|energetic)\b/i, vibe: "Solar Flare" },
  { re: /\b(tech|cyber|neon|midnight|digital|futur)\b/i, vibe: "Midnight Tech" },
  { re: /\b(vintage|boutique|curated|artisan|craft|gallery)\b/i, vibe: "Vintage Boutique" },
  { re: /\b(minimal|clean|simple|quiet|refined|airy)\b/i, vibe: "Modern Minimal" }
];
var SOFT_CONTRACT_VIBES = /* @__PURE__ */ new Set(["Modern Minimal"]);
function cleanString(value) {
  return typeof value === "string" ? value.trim() : "";
}
__name(cleanString, "cleanString");
__name2(cleanString, "cleanString");
function cleanList(value) {
  if (!Array.isArray(value)) return [];
  return value.map(cleanString).filter(Boolean);
}
__name(cleanList, "cleanList");
__name2(cleanList, "cleanList");
function clampWords(text, min, max) {
  const words = String(text || "").trim().split(/\s+/).filter(Boolean);
  if (words.length <= max && words.length >= min) return words.join(" ");
  if (words.length > max) return words.slice(0, max).join(" ");
  const pad = ["photography", "professional", "quality", "detail", "natural", "light"];
  const out = words.slice();
  let i = 0;
  while (out.length < min && i < pad.length) {
    out.push(pad[i++]);
  }
  return out.slice(0, max).join(" ");
}
__name(clampWords, "clampWords");
__name2(clampWords, "clampWords");
function stableHash(input) {
  const str = String(input || "");
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(31, h) + str.charCodeAt(i) | 0;
  }
  return Math.abs(h);
}
__name(stableHash, "stableHash");
__name2(stableHash, "stableHash");
function buildStyleSignalBlob(strategyContract, state, options = {}) {
  const { excludeContractVibe = false } = options;
  const a = state?.answers || {};
  const parts = [];
  if (!excludeContractVibe) {
    parts.push(cleanString(strategyContract?.visual_strategy?.recommended_vibe));
  }
  parts.push(
    cleanString(strategyContract?.business_context?.strategic_archetype),
    cleanString(strategyContract?.business_context?.one_page_fit),
    cleanString(a.tone_of_voice),
    cleanString(a.differentiation),
    cleanString(a.website_direction),
    cleanString(a.primary_offer),
    cleanList(strategyContract?.asset_policy?.preferred_image_themes).join(" "),
    cleanList(strategyContract?.visual_strategy?.preferred_image_themes).join(" ")
  );
  return parts.filter(Boolean).join(" ").toLowerCase();
}
__name(buildStyleSignalBlob, "buildStyleSignalBlob");
__name2(buildStyleSignalBlob, "buildStyleSignalBlob");
function extractVisualKeywords(blob, maxWords = 8) {
  const raw = String(blob || "").toLowerCase().replace(/[^a-z0-9\s]/g, " ");
  const tokens = raw.split(/\s+/).map((w) => w.trim()).filter((w) => w.length > 2 && !STOPWORDS.has(w));
  const seen = /* @__PURE__ */ new Set();
  const out = [];
  for (const t of tokens) {
    if (seen.has(t)) continue;
    seen.add(t);
    out.push(t);
    if (out.length >= maxWords) break;
  }
  return out;
}
__name(extractVisualKeywords, "extractVisualKeywords");
__name2(extractVisualKeywords, "extractVisualKeywords");
function scoreVibeFromBlob(blob) {
  if (!blob) return null;
  for (const rule of VIBE_STYLE_RULES) {
    if (rule.re.test(blob)) return rule.vibe;
  }
  return null;
}
__name(scoreVibeFromBlob, "scoreVibeFromBlob");
__name2(scoreVibeFromBlob, "scoreVibeFromBlob");
function selectVibe(allowedVibes, strategyContract, state) {
  const allowed = Array.isArray(allowedVibes) ? allowedVibes : SCHEMA_VIBES;
  const raw = cleanString(strategyContract?.visual_strategy?.recommended_vibe);
  const fromAnswers = cleanString(state?.answers?.vibe);
  if (fromAnswers && allowed.includes(fromAnswers)) return fromAnswers;
  const vibeFact = state?.blueprint?.fact_registry?.vibe;
  const fromFact = cleanString(vibeFact?.value);
  const factStatus = cleanString(vibeFact?.status);
  if (fromFact && allowed.includes(fromFact) && factStatus === "answered") return fromFact;
  const blobForScore = buildStyleSignalBlob(strategyContract, state, { excludeContractVibe: true });
  const scored = scoreVibeFromBlob(blobForScore);
  if (raw && allowed.includes(raw) && !SOFT_CONTRACT_VIBES.has(raw)) {
    return raw;
  }
  if (scored && allowed.includes(scored)) return scored;
  if (raw && allowed.includes(raw)) return raw;
  const blob = buildStyleSignalBlob(strategyContract, state);
  const arch = cleanString(strategyContract?.business_context?.strategic_archetype);
  const idx = stableHash(`${arch}|${blob}`) % allowed.length;
  return allowed[idx];
}
__name(selectVibe, "selectVibe");
__name2(selectVibe, "selectVibe");
function isObject(value) {
  return !!value && typeof value === "object" && !Array.isArray(value);
}
__name(isObject, "isObject");
__name2(isObject, "isObject");
function uniqueStableStrings(items) {
  const seen = /* @__PURE__ */ new Set();
  const out = [];
  for (const s of items) {
    const t = cleanString(s);
    if (!t) continue;
    const k = t.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(t);
  }
  return out;
}
__name(uniqueStableStrings, "uniqueStableStrings");
__name2(uniqueStableStrings, "uniqueStableStrings");
function rotateStable(arr, hash) {
  if (!Array.isArray(arr) || !arr.length) return arr;
  const off = Math.abs(hash) % arr.length;
  return [...arr.slice(off), ...arr.slice(0, off)];
}
__name(rotateStable, "rotateStable");
__name2(rotateStable, "rotateStable");
function deriveVisualPatterns(signalBlob, strategyModels) {
  const patterns = [];
  const exp = isObject(signalBlob?.experience_model) ? signalBlob.experience_model : {};
  const archetype = cleanString(signalBlob?.archetype || "");
  const processType = cleanString(strategyModels?.process_strategy?.type || "");
  if (cleanString(exp.visual_importance).toLowerCase() === "critical" || archetype.toLowerCase().includes("visual")) {
    patterns.push("transformation");
  }
  if (cleanString(exp.decision_mode).toLowerCase().includes("guided") || processType === "consultative") {
    patterns.push("process");
  }
  if (cleanString(exp.trust_requirement).toLowerCase() === "high_technical") {
    patterns.push("detail");
  }
  if (!patterns.length) {
    patterns.push("environment", "people");
  }
  return patterns;
}
__name(deriveVisualPatterns, "deriveVisualPatterns");
__name2(deriveVisualPatterns, "deriveVisualPatterns");
function buildQueriesFromPatterns(patterns) {
  const map = {
    transformation: [
      "before and after result comparison in clear even light",
      "final outcome showcase with calm confident atmosphere"
    ],
    process: [
      "professional at work in tidy unbranded real context",
      "behind the scenes workflow in organized calm workspace"
    ],
    detail: [
      "close-up detail precision with textured material clarity",
      "macro texture quality under soft natural side light"
    ],
    environment: [
      "authentic real world setting with warm ambient depth",
      "quiet interior environment scene with natural window light"
    ],
    people: [
      "candid customer interaction moment in approachable natural light",
      "calm human service moment with quiet trustworthy warmth"
    ]
  };
  return uniqueStableStrings(patterns.flatMap((p) => map[p] || []));
}
__name(buildQueriesFromPatterns, "buildQueriesFromPatterns");
__name2(buildQueriesFromPatterns, "buildQueriesFromPatterns");
function detectVisualModeFromSignals(visual) {
  const focus = Array.isArray(visual?.recommended_focus) ? visual.recommended_focus : [];
  const mustShow = Array.isArray(visual?.must_show) ? visual.must_show : [];
  const themes = Array.isArray(visual?.image_themes) ? visual.image_themes : [];
  const combined = [...focus, ...mustShow, ...themes].map((s) => String(s).toLowerCase());
  if (combined.length >= 2) {
    return "process";
  }
  if (themes.length > 0 && focus.length === 0) {
    return "interaction";
  }
  if (focus.length > 0 && mustShow.length === 0) {
    return "result";
  }
  return "general";
}
__name(detectVisualModeFromSignals, "detectVisualModeFromSignals");
__name2(detectVisualModeFromSignals, "detectVisualModeFromSignals");
function buildHeroKeywordSourceBlob(signalBlob, visual) {
  const focus = Array.isArray(visual?.recommended_focus) ? visual.recommended_focus : [];
  const mustShow = Array.isArray(visual?.must_show) ? visual.must_show : [];
  const themes = Array.isArray(visual?.image_themes) ? visual.image_themes : [];
  return [
    ...focus,
    ...mustShow,
    ...themes,
    cleanString(visual?.visual_story),
    cleanString(visual?.differentiation),
    cleanString(visual?.gallery_story),
    cleanString(signalBlob?.offer),
    cleanString(signalBlob?.positioning),
    cleanString(signalBlob?.opportunity),
    cleanString(signalBlob?.angle),
    cleanString(signalBlob?.category),
    cleanString(signalBlob?.archetype),
    cleanString(signalBlob?.persona)
  ].filter(Boolean).join(" ");
}
__name(buildHeroKeywordSourceBlob, "buildHeroKeywordSourceBlob");
__name2(buildHeroKeywordSourceBlob, "buildHeroKeywordSourceBlob");
function buildHeroImageQuery(signalBlob, strategyModels, state, resolvedVibe) {
  const visual = signalBlob?.visual || {};
  const focus = Array.isArray(visual.recommended_focus) ? visual.recommended_focus : [];
  const mustShow = Array.isArray(visual.must_show) ? visual.must_show : [];
  const themes = Array.isArray(visual.image_themes) ? visual.image_themes : [];
  const story = visual.visual_story || "";
  const differentiation = visual.differentiation || "";
  const galleryStory = visual.gallery_story || "";
  const signalPartsLower = [
    ...focus,
    ...mustShow,
    ...themes,
    story,
    differentiation,
    galleryStory,
    cleanString(signalBlob?.offer),
    cleanString(signalBlob?.positioning)
  ].filter(Boolean).join(" ").toLowerCase();
  const blobForKeywords = buildHeroKeywordSourceBlob(signalBlob, visual);
  let keywords = extractVisualKeywords(blobForKeywords, 14);
  if (keywords.length < 4 && cleanString(signalBlob?.offer)) {
    keywords = uniqueStableStrings([
      ...keywords,
      ...extractVisualKeywords(cleanString(signalBlob.offer), 10)
    ]).slice(0, 12);
  }
  const vibeHint = resolvedVibe ? String(resolvedVibe).toLowerCase() : "";
  let style = "natural window light";
  if (vibeHint.includes("minimal")) {
    style = "clean minimal natural light";
  } else if (vibeHint.includes("luxury")) {
    style = "soft refined light";
  } else if (vibeHint.includes("industrial")) {
    style = "workshop natural light";
  }
  if (keywords.length >= 3) {
    const core = keywords.slice(0, 10).join(" ");
    const detailHints2 = [];
    if (signalPartsLower.includes("frame") || signalPartsLower.includes("mat") || signalPartsLower.includes("matting")) {
      detailHints2.push("picture frame mat corner detail");
    }
    if (signalPartsLower.includes("gallery") || signalPartsLower.includes("showroom")) {
      detailHints2.push("gallery wall");
    }
    if (signalPartsLower.includes("artist") || signalPartsLower.includes("studio")) {
      detailHints2.push("artist studio");
    }
    const tail = detailHints2.length ? ` ${detailHints2[0]}` : "";
    return clampWords(`${core}${tail} ${style}`, 8, 22).trim();
  }
  const category = cleanString(signalBlob?.category) || "business";
  const mode = detectVisualModeFromSignals(visual);
  let subject = "";
  if (mode === "process") {
    subject = `${category} professional workspace craftsmanship`;
  } else if (mode === "interaction") {
    subject = `${category} customer consultation`;
  } else if (mode === "result") {
    subject = `${category} finished work on display`;
  } else {
    subject = `${category} professional interior`;
  }
  const detailHints = [];
  if (signalPartsLower.includes("craft") || signalPartsLower.includes("quality")) {
    detailHints.push("detail");
  }
  if (signalPartsLower.includes("custom") || signalPartsLower.includes("personal")) {
    detailHints.push("custom work");
  }
  if (signalPartsLower.includes("artist") || signalPartsLower.includes("creative")) {
    detailHints.push("creative workspace");
  }
  let query = [subject, ...detailHints, style].filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
  if (!query || query.length < 10) {
    query = `${category} professional realistic natural light`;
  }
  return clampWords(query, 6, 18).trim();
}
__name(buildHeroImageQuery, "buildHeroImageQuery");
__name2(buildHeroImageQuery, "buildHeroImageQuery");
function buildFallbackGalleryQueries(signalBlob, strategyModels, state, resolvedVibe) {
  const patterns = deriveVisualPatterns(signalBlob, strategyModels);
  let queries = buildQueriesFromPatterns(patterns);
  const slug = cleanString(state?.slug) || "site";
  const arch = cleanString(signalBlob?.archetype);
  const h = stableHash(`${slug}|${arch}|${patterns.join("|")}|${cleanString(resolvedVibe)}|gallery`);
  queries = rotateStable(queries, h);
  const sliced = queries.slice(0, 5);
  const visual = signalBlob?.visual || {};
  const prefixBlob = [
    ...cleanList(visual.recommended_focus),
    cleanString(signalBlob?.offer),
    cleanString(signalBlob?.category),
    cleanString(signalBlob?.positioning)
  ].filter(Boolean).join(" ");
  const prefixKw = extractVisualKeywords(prefixBlob, 6).slice(0, 4).join(" ");
  return sliced.map((q) => {
    if (!prefixKw) return clampWords(q, 4, 8);
    return clampWords(`${prefixKw} ${q}`, 6, 14);
  });
}
__name(buildFallbackGalleryQueries, "buildFallbackGalleryQueries");
__name2(buildFallbackGalleryQueries, "buildFallbackGalleryQueries");
function inferPremiumGalleryCount(strategyContract, state, vibe) {
  const themes = [
    ...cleanList(strategyContract?.asset_policy?.preferred_image_themes),
    ...cleanList(strategyContract?.visual_strategy?.preferred_image_themes)
  ];
  const arch = cleanString(strategyContract?.business_context?.strategic_archetype);
  const photoHint = cleanString(state?.answers?.photos_status).toLowerCase().includes("have") || cleanList(state?.answers?.gallery_queries).length > 0;
  const vi = cleanString(state?.preflight_intelligence?.experience_model?.visual_importance).toLowerCase();
  const visualBump = vi === "critical" ? 2 : vi === "high" ? 1 : 0;
  const base = 5 + stableHash(`${arch}|${vibe}|${themes.length}`) % 5;
  const bump = photoHint ? 1 : 0;
  return Math.min(9, base + bump + visualBump);
}
__name(inferPremiumGalleryCount, "inferPremiumGalleryCount");
__name2(inferPremiumGalleryCount, "inferPremiumGalleryCount");
function galleryLayoutFromSignals(strategyContract) {
  const themes = [
    ...cleanList(strategyContract?.asset_policy?.preferred_image_themes),
    ...cleanList(strategyContract?.visual_strategy?.preferred_image_themes)
  ];
  if (themes.length >= 4) return "masonry";
  if (themes.length >= 2) return "bento";
  const arch = cleanString(strategyContract?.business_context?.strategic_archetype);
  return ["grid", "masonry", "bento"][stableHash(arch) % 3];
}
__name(galleryLayoutFromSignals, "galleryLayoutFromSignals");
__name2(galleryLayoutFromSignals, "galleryLayoutFromSignals");
function assertFactorySynthesisGuards(data) {
  const vibe = cleanString(data?.settings?.vibe);
  if (!vibe) throw new Error("Factory synthesis failed: missing vibe");
  if (!SCHEMA_VIBES.includes(vibe)) throw new Error("Factory synthesis failed: invalid vibe");
  const heroQ = cleanString(data?.hero?.image?.image_search_query);
  if (!heroQ) throw new Error("Factory synthesis failed: missing hero image query");
}
__name(assertFactorySynthesisGuards, "assertFactorySynthesisGuards");
__name2(assertFactorySynthesisGuards, "assertFactorySynthesisGuards");
function cleanString2(value) {
  return typeof value === "string" ? value.trim() : "";
}
__name(cleanString2, "cleanString2");
__name2(cleanString2, "cleanString");
function isGuidedDecisionMode(decisionMode) {
  const s = cleanString2(decisionMode).toLowerCase();
  return s === "guided" || s === "consultative" || s.includes("guided");
}
__name(isGuidedDecisionMode, "isGuidedDecisionMode");
__name2(isGuidedDecisionMode, "isGuidedDecisionMode");
function enhanceProcessSteps(processSteps, signalBlob, behavior) {
  if (!Array.isArray(processSteps)) return processSteps;
  return processSteps.map((step) => {
    const description = step.description || "";
    return {
      ...step,
      description: truncate(description, 220)
    };
  });
}
__name(enhanceProcessSteps, "enhanceProcessSteps");
__name2(enhanceProcessSteps, "enhanceProcessSteps");
function enhanceHero(hero, signalBlob, behavior) {
  if (!hero) return hero;
  let headline = hero.headline || "";
  let subtext = hero.subtext || "";
  const positioning = cleanString2(signalBlob?.positioning);
  const angle = cleanString2(signalBlob?.angle);
  const decisionMode = signalBlob?.experience_model?.decision_mode;
  if (angle) {
    headline = angle;
  } else if (positioning) {
    headline = positioning;
  }
  if (behavior?.trust_sensitivity === "high") {
    subtext = addReassurance(subtext);
  } else if (isGuidedDecisionMode(decisionMode)) {
    subtext = makeConsultative(subtext, positioning);
  }
  return {
    ...hero,
    headline: truncateAtWordBoundary(headline, 120),
    subtext: truncateAtWordBoundary(subtext, 220)
  };
}
__name(enhanceHero, "enhanceHero");
__name2(enhanceHero, "enhanceHero");
function truncateAtWordBoundary(str, max) {
  if (!str) return "";
  if (str.length <= max) return str;
  const budget = max - 3;
  const slice = str.slice(0, budget);
  const lastSpace = slice.lastIndexOf(" ");
  if (lastSpace > Math.floor(budget * 0.5)) return `${slice.slice(0, lastSpace).trim()}...`;
  return `${slice.trim()}...`;
}
__name(truncateAtWordBoundary, "truncateAtWordBoundary");
__name2(truncateAtWordBoundary, "truncateAtWordBoundary");
function makeConsultative(text, narrative) {
  if (!text) return narrative || "";
  return `${text} We guide you through each step so you feel confident in every decision.`;
}
__name(makeConsultative, "makeConsultative");
__name2(makeConsultative, "makeConsultative");
function addReassurance(text) {
  if (!text) return text;
  return `${text} Built with care and attention to detail you can trust.`;
}
__name(addReassurance, "addReassurance");
__name2(addReassurance, "addReassurance");
function truncate(str, max) {
  return truncateAtWordBoundary(str, max);
}
__name(truncate, "truncate");
__name2(truncate, "truncate");
var ALLOWED_MENU_PATHS = [
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
var ALLOWED_ICON_TOKENS = [
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
async function onRequestPost2(context) {
  try {
    const body = await readJson(context.request);
    const state = normalizeState(body.state || {});
    const action = cleanString3(body.action || state.action || "");
    if (!cleanString3(state.slug)) {
      return json2({ ok: false, error: "Missing state.slug" }, 400);
    }
    const strategyContract = getStrategyContract(state);
    if (!strategyContract) {
      return json2({ ok: false, error: "Missing strategy_contract in state" }, 400);
    }
    state.readiness = evaluateNarrativeReadiness(state);
    state.enrichment = evaluateEnrichment(state);
    if (!state.readiness.can_generate_now) {
      return json2(
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
      return json2(
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
      return json2(
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
      slug: cleanString3(state.slug),
      readiness: state.readiness,
      enrichment: state.enrichment,
      strategy_brief: strategyBrief,
      business_json: businessJson,
      business_base_json: businessJson
    };
    if (action === "complete") {
      payload.submit = await trySubmitBusinessJson(context.request, {
        business_json: businessJson,
        client_email: cleanString3(state.clientEmail) || cleanString3(businessJson?.brand?.email)
      });
    }
    return json2(payload);
  } catch (err) {
    console.error("[intake-complete]", err);
    return json2(
      {
        ok: false,
        error: String(err?.message || err)
      },
      500
    );
  }
}
__name(onRequestPost2, "onRequestPost2");
__name2(onRequestPost2, "onRequestPost");
async function onRequestGet2() {
  return json2({
    ok: true,
    endpoint: "intake-complete",
    method: "POST"
  });
}
__name(onRequestGet2, "onRequestGet2");
__name2(onRequestGet2, "onRequestGet");
function buildStrategyBrief(state, strategyContract) {
  const signalBlob = buildSignalBlob(state, strategyContract);
  const derived_behavior = deriveBehavior(signalBlob);
  return {
    business_name: cleanString3(state.businessName),
    slug: cleanString3(state.slug),
    category: cleanString3(strategyContract.business_context?.category),
    strategic_archetype: cleanString3(strategyContract.business_context?.strategic_archetype),
    one_page_fit: cleanString3(strategyContract.business_context?.one_page_fit),
    primary_conversion: cleanString3(strategyContract.conversion_strategy?.primary_conversion),
    secondary_conversion: cleanString3(strategyContract.conversion_strategy?.secondary_conversion),
    conversion_mode: cleanString3(strategyContract.conversion_strategy?.conversion_mode),
    audience: cleanString3(state.answers?.audience),
    primary_offer: cleanString3(state.answers?.primary_offer),
    service_area: cleanString3(state.answers?.service_area),
    trust_signal: cleanString3(state.answers?.trust_signal),
    differentiation: cleanString3(state.answers?.differentiation),
    recommended_vibe: cleanString3(strategyContract.visual_strategy?.recommended_vibe),
    schema_toggles: isObject2(strategyContract.schema_toggles) ? strategyContract.schema_toggles : {},
    asset_policy: isObject2(strategyContract.asset_policy) ? strategyContract.asset_policy : {},
    copy_policy: isObject2(strategyContract.copy_policy) ? strategyContract.copy_policy : {},
    signal_blob: summarizeSignalBlobForBrief(signalBlob),
    derived_behavior,
    proof_angle_suggestions: generateProofAngles(signalBlob)
  };
}
__name(buildStrategyBrief, "buildStrategyBrief");
__name2(buildStrategyBrief, "buildStrategyBrief");
function firstNonEmpty(values) {
  const list = Array.isArray(values) ? values : [values];
  for (const v of list) {
    const s = cleanString3(typeof v === "string" ? v : String(v ?? ""));
    if (s) return s;
  }
  return "";
}
__name(firstNonEmpty, "firstNonEmpty");
__name2(firstNonEmpty, "firstNonEmpty");
function buildSignalBlob(state, strategyContract) {
  const sc = isObject2(strategyContract) ? strategyContract : {};
  const answers = isObject2(state?.answers) ? state.answers : {};
  const pi = isObject2(state?.preflight_intelligence) ? state.preflight_intelligence : {};
  const bc = isObject2(sc.business_context) ? sc.business_context : {};
  const am = isObject2(sc.audience_model) ? sc.audience_model : {};
  const pm = isObject2(sc.proof_model) ? sc.proof_model : {};
  const cs = isObject2(sc.conversion_strategy) ? sc.conversion_strategy : {};
  const positioning = firstNonEmpty([answers.business_understanding, pi.positioning]);
  const opportunity = firstNonEmpty([answers.opportunity, pi.opportunity]);
  const websiteDirection = firstNonEmpty([answers.website_direction, pi.website_direction]);
  const aeoFirst = cleanList2(answers.aeo_angles)[0] || "";
  const angle = firstNonEmpty([
    aeoFirst,
    pi.winning_angle,
    pi.differentiation_hypothesis,
    am.primary_persona
  ]);
  const objections = uniqueList([
    ...cleanList2(answers.common_objections),
    ...cleanList2(pm.common_objections),
    ...cleanList2(pi.common_objections),
    ...cleanList2(pi.weaknesses)
  ]);
  const trust = uniqueList([
    cleanString3(answers.trust_signal),
    ...cleanList2(answers.trust_signals),
    ...cleanList2(pm.trust_signals),
    ...cleanList2(pi.trust_markers)
  ]).filter(Boolean);
  const factors = uniqueList([
    ...cleanList2(answers.buyer_decision_factors),
    ...cleanList2(am.decision_factors),
    ...cleanList2(pi.buyer_factors)
  ]);
  const persona = firstNonEmpty([answers.audience, am.primary_persona, pi.target_persona_hint]);
  const em = isObject2(pi.experience_model) ? pi.experience_model : {};
  const proc = isObject2(pi.process_model) ? pi.process_model : {};
  const prc = isObject2(pi.pricing_model) ? pi.pricing_model : {};
  const vis = isObject2(pi.visual_strategy) ? pi.visual_strategy : {};
  const textBlob = [
    cleanString3(answers.primary_offer),
    cleanString3(answers.differentiation),
    cleanString3(opportunity),
    cleanString3(positioning),
    cleanString3(websiteDirection),
    cleanString3(answers.process_notes),
    cleanString3(answers.trust_signal),
    cleanString3(answers.tone_of_voice),
    cleanString3(angle),
    cleanString3(pi.differentiation_hypothesis),
    cleanString3(em.purchase_type),
    cleanString3(em.decision_mode),
    cleanString3(em.visual_importance),
    cleanString3(em.trust_requirement),
    cleanString3(em.pricing_behavior),
    cleanString3(em.experience_rationale),
    cleanString3(proc.process_narrative),
    ...cleanList2(proc.buyer_anxiety),
    ...cleanList2(proc.reassurance_devices),
    cleanString3(prc.site_treatment),
    cleanString3(prc.pricing_notes),
    cleanString3(vis.gallery_story),
    ...cleanList2(vis.must_show),
    ...objections,
    ...factors,
    ...cleanList2(answers.aeo_angles),
    ...cleanList2(pi.recommended_focus),
    ...cleanList2(pi.local_alternatives)
  ].join(" ").toLowerCase();
  const visual = {
    recommended_focus: uniqueList([...cleanList2(answers?.recommended_focus), ...cleanList2(pi?.recommended_focus)]),
    visual_story: cleanString3(pi?.website_direction),
    differentiation: firstNonEmpty([answers.differentiation, pi?.differentiation_hypothesis]),
    trust_context: cleanList2(pi?.trust_markers),
    gallery_story: cleanString3(vis?.gallery_story),
    must_show: cleanList2(vis?.must_show),
    image_themes: cleanList2(answers?.image_themes),
    gallery_visual_direction: cleanString3(answers?.gallery_visual_direction)
  };
  return {
    offer: cleanString3(answers.primary_offer),
    model: cleanString3(bc.business_model),
    positioning,
    opportunity,
    angle,
    objections,
    trust,
    tone: cleanString3(answers.tone_of_voice) || inferTone(sc),
    category: cleanString3(bc.category) || cleanString3(answers.industry) || cleanString3(answers.category),
    /** Opaque strategy slug — used by factory visual patterns (not NAICS / industry routing). */
    archetype: cleanString3(bc.strategic_archetype),
    persona,
    primary_conversion: cleanString3(cs.primary_conversion),
    decision_factors: factors,
    text_blob: textBlob,
    experience_model: em,
    process_model: proc,
    pricing_model: prc,
    visual_strategy: vis,
    component_importance: isObject2(pi.component_importance) ? pi.component_importance : {},
    visual
  };
}
__name(buildSignalBlob, "buildSignalBlob");
__name2(buildSignalBlob, "buildSignalBlob");
function buildStrategyModels(signalBlob) {
  const exp = isObject2(signalBlob?.experience_model) ? signalBlob.experience_model : {};
  const visual = isObject2(signalBlob?.visual_strategy) ? signalBlob.visual_strategy : {};
  const process = isObject2(signalBlob?.process_model) ? signalBlob.process_model : {};
  const pricing = isObject2(signalBlob?.pricing_model) ? signalBlob.pricing_model : {};
  const trustSignals = Array.isArray(signalBlob?.trust) ? signalBlob.trust.filter(Boolean) : [];
  const stepsEmphasis = process.steps_emphasis;
  const steps = Array.isArray(stepsEmphasis) && stepsEmphasis.length ? stepsEmphasis.map((s) => cleanString3(s)).filter(Boolean) : cleanString3(stepsEmphasis) ? [cleanString3(stepsEmphasis)] : ["discover", "decide", "deliver"];
  return {
    visual_strategy: {
      type: cleanString3(exp.visual_importance).toLowerCase() === "critical" ? "transformation" : "supporting",
      focus: cleanList2(visual.must_show),
      intent: cleanString3(visual.primary_visual_job) || "showcase work in real-world context"
    },
    process_strategy: {
      type: cleanString3(exp.decision_mode).toLowerCase() === "guided" ? "consultative" : "simple",
      goal: cleanList2(process.buyer_anxiety)[0] || "help customer understand what to expect",
      steps
    },
    trust_strategy: {
      type: cleanString3(exp.trust_requirement).toLowerCase() === "high_technical" ? "technical_authority" : "general",
      proof: trustSignals.length ? trustSignals : ["quality", "experience", "reliability"]
    },
    pricing_strategy: {
      type: /\bvariable\b/i.test(cleanString3(exp.pricing_behavior)) ? "variable" : "fixed",
      display: cleanString3(pricing.site_treatment) || "standard",
      cta: cleanString3(pricing.cta_alignment) || "contact"
    }
  };
}
__name(buildStrategyModels, "buildStrategyModels");
__name2(buildStrategyModels, "buildStrategyModels");
function capitalizeStrategyStep(s) {
  const t = cleanString3(s);
  if (!t) return "";
  return t.charAt(0).toUpperCase() + t.slice(1);
}
__name(capitalizeStrategyStep, "capitalizeStrategyStep");
__name2(capitalizeStrategyStep, "capitalizeStrategyStep");
function summarizeSignalBlobForBrief(blob) {
  if (!isObject2(blob)) return {};
  return {
    offer: blob.offer,
    model: blob.model,
    tone: blob.tone,
    category: blob.category,
    persona: blob.persona,
    primary_conversion: blob.primary_conversion,
    positioning: blob.positioning,
    opportunity: blob.opportunity,
    angle: blob.angle,
    objection_count: Array.isArray(blob.objections) ? blob.objections.length : 0,
    trust_signal_count: Array.isArray(blob.trust) ? blob.trust.length : 0,
    decision_factor_count: Array.isArray(blob.decision_factors) ? blob.decision_factors.length : 0,
    text_blob_preview: cleanString3(blob.text_blob).slice(0, 360)
  };
}
__name(summarizeSignalBlobForBrief, "summarizeSignalBlobForBrief");
__name2(summarizeSignalBlobForBrief, "summarizeSignalBlobForBrief");
function deriveBehavior(signalBlob) {
  const blob = cleanString3(signalBlob?.text_blob);
  const em = isObject2(signalBlob?.experience_model) ? signalBlob.experience_model : {};
  let decision_style = inferDecisionStyle(signalBlob, blob);
  let trust_sensitivity = inferTrustSensitivity(signalBlob, blob);
  let complexity = inferComplexity(signalBlob, blob);
  let purchase_trigger = inferPurchaseTrigger(signalBlob, blob);
  const dm = cleanString3(em.decision_mode).toLowerCase();
  if (dm && (dm.includes("guided") || dm === "guided_education" || dm === "appointment_required" || dm === "multi_visit_decision" || dm === "committee_or_family")) {
    if (complexity === "simple") complexity = "guided";
  }
  if (dm === "multi_visit_decision" || dm === "committee_or_family") {
    complexity = "expert_required";
    decision_style = "considered";
  }
  const pt = cleanString3(em.purchase_type).toLowerCase();
  if (pt && (pt.includes("consultative") || pt.includes("high_stakes") || pt.includes("scheduled_experience") || pt.includes("relationship_ongoing"))) {
    if (complexity === "simple") complexity = "guided";
    if (decision_style === "fast") decision_style = "considered";
  }
  const trq = cleanString3(em.trust_requirement).toLowerCase();
  if (trq.includes("high_technical") || trq.includes("safety") || trq.includes("compliance")) {
    trust_sensitivity = "high";
  }
  const vi = cleanString3(em.visual_importance).toLowerCase();
  if (vi === "critical" || vi === "high") {
    purchase_trigger = "visual";
  }
  return {
    decision_style,
    trust_sensitivity,
    complexity,
    differentiation_type: inferDifferentiationType(signalBlob, blob),
    purchase_trigger
  };
}
__name(deriveBehavior, "deriveBehavior");
__name2(deriveBehavior, "deriveBehavior");
function inferDecisionStyle(signalBlob, blob) {
  const pc = cleanString3(signalBlob?.primary_conversion).toLowerCase();
  if (pc.includes("call") || /\burgent|today|asap|right away|same day\b/.test(blob)) return "fast";
  const objN = signalBlob?.objections?.length || 0;
  const dfN = signalBlob?.decision_factors?.length || 0;
  if (/\bfeel|meaningful|care|peace of mind|family|special\b/.test(blob) || objN + dfN >= 4) {
    return "emotional";
  }
  if (objN >= 1 || dfN >= 2 || /\bcompare|research|evaluate|plan\b/.test(blob)) return "considered";
  return "considered";
}
__name(inferDecisionStyle, "inferDecisionStyle");
__name2(inferDecisionStyle, "inferDecisionStyle");
function inferTrustSensitivity(signalBlob, blob) {
  const objN = signalBlob?.objections?.length || 0;
  if (objN >= 2 || /\bworry|concern|risk|hesitat|scam|not sure\b/.test(blob)) return "high";
  const tN = signalBlob?.trust?.length || 0;
  if (tN >= 2 || /\btrust|review|proof|credential|insured\b/.test(blob)) return "medium";
  if (objN === 0 && tN === 0 && blob.length < 80) return "low";
  return "medium";
}
__name(inferTrustSensitivity, "inferTrustSensitivity");
__name2(inferTrustSensitivity, "inferTrustSensitivity");
function inferComplexity(signalBlob, blob) {
  const objN = signalBlob?.objections?.length || 0;
  const dfN = signalBlob?.decision_factors?.length || 0;
  if (objN >= 2 || dfN >= 4 || /\b(assess|diagnos|consult|custom|tailor|inspection|evaluation|scope|quote)\b/.test(blob)) {
    return "expert_required";
  }
  if (/\b(book online|flat rate|instant|quick checkout|one tap)\b/.test(blob) && objN === 0 && dfN < 2) {
    return "simple";
  }
  return "guided";
}
__name(inferComplexity, "inferComplexity");
__name2(inferComplexity, "inferComplexity");
function inferDifferentiationType(signalBlob, blob) {
  const scores = {
    quality: scoreKeywordGroups(blob, [/quality|craft|detail|premium|professional|careful/]),
    speed: scoreKeywordGroups(blob, [/fast|quick|rush|same day|responsive|turnaround/]),
    price: scoreKeywordGroups(blob, [/afford|budget|price|value|rate|fair/]),
    experience: scoreKeywordGroups(blob, [/experience|journey|service|relationship|white[\s-]?glove/])
  };
  let best = "experience";
  let max = -1;
  for (const [k, v] of Object.entries(scores)) {
    if (v > max) {
      max = v;
      best = k;
    }
  }
  return best;
}
__name(inferDifferentiationType, "inferDifferentiationType");
__name2(inferDifferentiationType, "inferDifferentiationType");
function scoreKeywordGroups(blob, patterns) {
  let n = 0;
  for (const re of patterns) {
    const m = blob.match(re);
    if (m) n += m.length;
  }
  return n;
}
__name(scoreKeywordGroups, "scoreKeywordGroups");
__name2(scoreKeywordGroups, "scoreKeywordGroups");
function inferPurchaseTrigger(signalBlob, blob) {
  if (/\burgent|emergency|today|asap\b/.test(blob)) return "urgent";
  if (/\bphoto|gallery|before|after|see the|visual\b/.test(blob)) return "visual";
  if (/\brefer|reputation|word of mouth|local|neighbor\b/.test(blob)) return "relationship";
  const style = inferDecisionStyle(signalBlob, blob);
  if (style === "fast") return "urgent";
  return "relationship";
}
__name(inferPurchaseTrigger, "inferPurchaseTrigger");
__name2(inferPurchaseTrigger, "inferPurchaseTrigger");
function generateProofAngles(signalBlob) {
  const out = [];
  const objections = Array.isArray(signalBlob?.objections) ? signalBlob.objections : [];
  for (const o of objections.slice(0, 3)) {
    const t = cleanString3(o);
    if (!t) continue;
    out.push(`Address the worry: \u201C${cleanSentenceFragment(t)}\u201D with a concrete proof point on the page.`);
  }
  const firstTrust = cleanString3(signalBlob?.trust?.[0]);
  if (firstTrust && out.length < 3) {
    out.push(`Echo this trust anchor in headline or proof: ${firstTrust}.`);
  }
  return out.slice(0, 4);
}
__name(generateProofAngles, "generateProofAngles");
__name2(generateProofAngles, "generateProofAngles");
var PI_IMPORTANCE_RANK = { none: 0, low: 1, medium: 2, high: 3, critical: 4 };
function piImportanceRank(value) {
  const v = cleanString3(value).toLowerCase();
  return PI_IMPORTANCE_RANK[v] ?? 0;
}
__name(piImportanceRank, "piImportanceRank");
__name2(piImportanceRank, "piImportanceRank");
function piImportanceAtLeast(importance, key, minLevel) {
  if (!isObject2(importance)) return false;
  return piImportanceRank(importance[key]) >= piImportanceRank(minLevel);
}
__name(piImportanceAtLeast, "piImportanceAtLeast");
__name2(piImportanceAtLeast, "piImportanceAtLeast");
function processShapeFromPreflightModel(processModel) {
  if (!isObject2(processModel)) return null;
  const e = cleanString3(processModel.steps_emphasis).toLowerCase();
  const map = {
    walk_in_simple: ["request", "confirm", "complete"],
    call_first: ["request", "confirm", "deliver"],
    schedule_consult: ["diagnose", "guide", "deliver"],
    quote_then_schedule: ["request", "confirm", "deliver"],
    deposit_milestone: ["diagnose", "guide", "deliver"],
    remote_then_in_person: ["request", "guide", "deliver"]
  };
  return map[e] || null;
}
__name(processShapeFromPreflightModel, "processShapeFromPreflightModel");
__name2(processShapeFromPreflightModel, "processShapeFromPreflightModel");
function generateProcessShape(behavior) {
  if (behavior.complexity === "expert_required") {
    return ["diagnose", "guide", "deliver"];
  }
  if (behavior.decision_style === "fast") {
    return ["request", "confirm", "complete"];
  }
  return ["discover", "decide", "experience"];
}
__name(generateProcessShape, "generateProcessShape");
__name2(generateProcessShape, "generateProcessShape");
function buildSyntheticProcessSteps(shape, behavior) {
  const dt = behavior.differentiation_type;
  const variant = ["quality", "speed", "price", "experience"].includes(dt) ? dt : "experience";
  const library = PROCESS_STEP_LIBRARY;
  return shape.map((key) => {
    const pack = library[key] || library.discover;
    const desc = pack.body[variant] || pack.body.experience || "We keep the workflow clear from first contact through completion.";
    return {
      title: normalizePublicText(pack.title),
      description: normalizePublicText(cleanSentence(desc))
    };
  });
}
__name(buildSyntheticProcessSteps, "buildSyntheticProcessSteps");
__name2(buildSyntheticProcessSteps, "buildSyntheticProcessSteps");
var PROCESS_STEP_LIBRARY = {
  diagnose: {
    title: "Understand goals and constraints",
    body: {
      quality: "We start by clarifying priorities, fit, and the quality standard you want so the plan matches reality.",
      speed: "We align quickly on timing, urgent needs, and the fastest safe path from first contact to completion.",
      price: "We define scope and options early so pricing stays understandable before work begins.",
      experience: "We begin by mapping what you need, what success looks like, and any constraints that should shape the plan."
    }
  },
  guide: {
    title: "Choose the right approach",
    body: {
      quality: "We recommend an approach that protects craftsmanship and sets expectations before work starts.",
      speed: "We lock the leanest sequence that still protects the outcome, with clear checkpoints along the way.",
      price: "We match the plan to your budget band and tradeoffs so there are no surprises midstream.",
      experience: "We recommend a path that fits your situation, then confirm details so expectations stay aligned."
    }
  },
  deliver: {
    title: "Deliver with care",
    body: {
      quality: "Execution focuses on detail, finish, and a result that holds up to scrutiny.",
      speed: "Work moves efficiently with proactive updates so you always know what happens next.",
      price: "Delivery stays within the agreed scope and communicates value clearly at handoff.",
      experience: "We carry the work through completion with communication, care, and a clean finish."
    }
  },
  request: {
    title: "Start with a simple request",
    body: {
      quality: "You reach out with the basics; we respond with a clear sense of fit and next steps.",
      speed: "You make a fast first move; we confirm timing and priorities immediately.",
      price: "You share enough for a realistic range or quote path before anything is locked in.",
      experience: "You reach out with what you need; we respond quickly with a human, helpful next step."
    }
  },
  confirm: {
    title: "Confirm the plan",
    body: {
      quality: "We confirm scope and standards so quality expectations are explicit before work begins.",
      speed: "We lock the essentials in one pass so momentum doesn\u2019t stall on back-and-forth.",
      price: "We confirm what\u2019s included, timing, and price bands so the agreement feels transparent.",
      experience: "We align on scope, timing, and responsibilities so everyone shares the same picture."
    }
  },
  complete: {
    title: "Complete and follow through",
    body: {
      quality: "Work finishes with a careful handoff and attention to the details that matter most.",
      speed: "We close the loop quickly with clear completion and any quick fixes if needed.",
      price: "We finish within the agreed scope and make sure value landed as expected.",
      experience: "We complete the work with clear communication and a polished handoff you can trust."
    }
  },
  discover: {
    title: "Explore fit",
    body: {
      quality: "You learn how the work is done, what quality means here, and whether it matches your bar.",
      speed: "You see how fast we can move and what we need from you to keep things on track.",
      price: "You understand options and ranges early so you can decide comfortably.",
      experience: "You get a clear feel for how it feels to work together before you commit."
    }
  },
  decide: {
    title: "Decide with confidence",
    body: {
      quality: "You choose a path that reflects the level of care and finish you want.",
      speed: "You pick timing and priorities so the next steps stay simple and predictable.",
      price: "You select an option that fits your budget without hiding tradeoffs.",
      experience: "You choose next steps with enough clarity that the decision feels grounded, not rushed."
    }
  },
  experience: {
    title: "Experience the outcome",
    body: {
      quality: "Delivery focuses on a result you\u2019re proud to show off and that matches what was promised.",
      speed: "You get a fast, clean finish with minimal friction at handoff.",
      price: "The outcome matches the agreed scope and feels worth what you invested.",
      experience: "The experience ends with a result that matches the story the site told up front."
    }
  }
};
function toggleOptOut(schemaToggles, key, computedShow) {
  if (schemaToggles?.[key] === false) return false;
  return Boolean(computedShow);
}
__name(toggleOptOut, "toggleOptOut");
__name2(toggleOptOut, "toggleOptOut");
function shouldShowProcess({ behavior, processSteps, componentImportance }) {
  if (piImportanceAtLeast(componentImportance, "process", "high")) return true;
  const steps = Array.isArray(processSteps) ? processSteps : [];
  if (steps.length >= 3) return true;
  if (behavior?.complexity && behavior.complexity !== "simple") return true;
  return false;
}
__name(shouldShowProcess, "shouldShowProcess");
__name2(shouldShowProcess, "shouldShowProcess");
function shouldShowTestimonials({ behavior, testimonials, componentImportance }) {
  if (piImportanceAtLeast(componentImportance, "testimonials", "high")) return true;
  const list = Array.isArray(testimonials) ? testimonials : [];
  if (list.length >= 2) return true;
  if (behavior?.trust_sensitivity === "high" && list.length >= 1) return true;
  return false;
}
__name(shouldShowTestimonials, "shouldShowTestimonials");
__name2(shouldShowTestimonials, "shouldShowTestimonials");
function shouldShowTrustbar({ behavior, trustbar }) {
  const n = trustbar?.items?.length ?? 0;
  if (n >= 2) return true;
  if (behavior?.trust_sensitivity === "high" && n >= 1) return true;
  return false;
}
__name(shouldShowTrustbar, "shouldShowTrustbar");
__name2(shouldShowTrustbar, "shouldShowTrustbar");
function shouldShowGallery({ behavior, gallery, experienceModel }) {
  const vi = cleanString3(experienceModel?.visual_importance).toLowerCase();
  if (vi === "critical" || vi === "high") return true;
  const items = gallery?.items;
  const n = Array.isArray(items) ? items.length : 0;
  if (n >= 3) return true;
  if (behavior?.purchase_trigger === "visual" && n >= 1) return true;
  return false;
}
__name(shouldShowGallery, "shouldShowGallery");
__name2(shouldShowGallery, "shouldShowGallery");
function shouldShowInvestmentSection(state, strategyContract) {
  const pi = isObject2(state?.preflight_intelligence) ? state.preflight_intelligence : {};
  const ci = isObject2(pi.component_importance) ? pi.component_importance : {};
  const pm = isObject2(pi.pricing_model) ? pi.pricing_model : {};
  const em = isObject2(pi.experience_model) ? pi.experience_model : {};
  if (piImportanceAtLeast(ci, "investment", "medium")) return true;
  if (piImportanceAtLeast(ci, "pricing_section", "high")) return true;
  const pb = cleanString3(em.pricing_behavior).toLowerCase();
  if (pb.includes("transparent_list") || pb.includes("starting_at")) return true;
  const rk = cleanString3(pm.risk_language).toLowerCase();
  if (rk.includes("full_transparency")) return true;
  return false;
}
__name(shouldShowInvestmentSection, "shouldShowInvestmentSection");
__name2(shouldShowInvestmentSection, "shouldShowInvestmentSection");
function shouldShowFaqs({ behavior, faqs }) {
  const list = Array.isArray(faqs) ? faqs : [];
  if (list.length >= 3) return true;
  if (behavior?.decision_style === "considered" && list.length >= 1) return true;
  return false;
}
__name(shouldShowFaqs, "shouldShowFaqs");
__name2(shouldShowFaqs, "shouldShowFaqs");
function cleanText(str) {
  if (typeof str !== "string") return "";
  return str.replace(/\s+/g, " ").trim();
}
__name(cleanText, "cleanText");
__name2(cleanText, "cleanText");
function capitalizeFirst(str) {
  if (typeof str !== "string" || !str.length) return "";
  return str.charAt(0).toUpperCase() + str.slice(1);
}
__name(capitalizeFirst, "capitalizeFirst");
__name2(capitalizeFirst, "capitalizeFirst");
function synthesizeHero(facts, _preflight) {
  const offer = cleanString3(facts?.primary_offer?.value || "");
  const diff = cleanString3(facts?.differentiation?.value || "");
  const persona = cleanString3(facts?.target_persona?.value || "");
  const cleanPersona = persona.includes("\xB7") ? "" : persona;
  let headline = buildPositionedHeadline(offer, diff);
  let subtext = "";
  if (cleanPersona && offer) {
    subtext = `Designed for ${cleanPersona.toLowerCase()} who want ${extractCoreOutcome(offer).toLowerCase()}.`;
  } else if (offer) {
    subtext = `Focused on delivering ${extractCoreOutcome(offer).toLowerCase()} with quality and precision.`;
  } else {
    subtext = "Built around your strengths, designed to convert.";
  }
  return {
    headline: cleanText(headline),
    subtext: cleanText(subtext)
  };
}
__name(synthesizeHero, "synthesizeHero");
__name2(synthesizeHero, "synthesizeHero");
function synthesizeFeatures(facts) {
  const offer = cleanString3(facts?.primary_offer?.value || "");
  const diff = cleanString3(facts?.differentiation?.value || "");
  const signals = detectFeatureSignals(offer, diff);
  const features = [];
  for (const signal of signals) {
    features.push(buildFeatureFromSignal(signal, offer, diff));
  }
  while (features.length < 3) {
    features.push(buildFallbackFeature(features.length, offer));
  }
  return features.slice(0, 6);
}
__name(synthesizeFeatures, "synthesizeFeatures");
__name2(synthesizeFeatures, "synthesizeFeatures");
function synthesizeAbout(facts) {
  const offer = cleanString3(facts?.primary_offer?.value || "");
  const diff = cleanString3(facts?.differentiation?.value || "");
  const persona = cleanString3(facts?.target_persona?.value || "");
  const core = extractCoreOutcome(offer) || "what we do";
  const angle = extractValueAngle(diff);
  const cleanPersona = persona.includes("\xB7") ? "" : persona.toLowerCase();
  const intro = buildAboutIntro(core, angle);
  const body = buildAboutBody(core, cleanPersona, angle);
  const closing = buildAboutClosing(core);
  return {
    headline: `Built Around ${capitalizeFirst(core)}`,
    paragraphs: [intro, body, closing].filter(Boolean)
  };
}
__name(synthesizeAbout, "synthesizeAbout");
__name2(synthesizeAbout, "synthesizeAbout");
function buildAboutIntro(core, angle) {
  return `Everything we do is centered around ${core.toLowerCase()} that ${angle}.`;
}
__name(buildAboutIntro, "buildAboutIntro");
__name2(buildAboutIntro, "buildAboutIntro");
function buildAboutBody(core, persona, angle) {
  if (persona) {
    return `We focus on helping ${persona} achieve ${applyAngle(core, angle, 2)} in a way that feels consistent and reliable.`;
  }
  return `Our approach is simple \u2014 focus on doing the work right, and make sure the end result holds up over time.`;
}
__name(buildAboutBody, "buildAboutBody");
__name2(buildAboutBody, "buildAboutBody");
function buildAboutClosing(core) {
  return `From start to finish, every ${core.toLowerCase()} is handled with care, clarity, and attention to what matters most.`;
}
__name(buildAboutClosing, "buildAboutClosing");
__name2(buildAboutClosing, "buildAboutClosing");
function synthesizeTestimonials(facts, signalBlob, behavior) {
  const objections = Array.isArray(signalBlob?.objections) ? signalBlob.objections : [];
  const trustSignals = Array.isArray(signalBlob?.trust) ? signalBlob.trust : [];
  const offerRaw = cleanString3(facts?.primary_offer?.value || "");
  const diffRaw = cleanString3(facts?.differentiation?.value || "");
  const core = extractCoreOutcome(offerRaw) || "the result";
  const angle = extractValueAngle(diffRaw);
  const testimonials = [];
  if (objections.length) {
    const obj = cleanString3(objections[0]).toLowerCase();
    testimonials.push({
      quote: `We had concerns about ${obj}, but the process made everything clear and ${applyTestimonialTone(core, angle, 0)}.`,
      author: "Client",
      focus: "objection"
    });
  }
  testimonials.push({
    quote: `${applyTestimonialTone(core, angle, 1)}, exactly what we were looking for.`,
    author: "Client",
    focus: "outcome"
  });
  if (behavior?.trust_sensitivity === "high" || trustSignals.length) {
    testimonials.push({
      quote: `From the first step to ${applyTestimonialTone(core, angle, 2)}, everything felt clear, consistent, and reliable.`,
      author: "Client",
      focus: "trust"
    });
  }
  return testimonials.slice(0, 3);
}
__name(synthesizeTestimonials, "synthesizeTestimonials");
__name2(synthesizeTestimonials, "synthesizeTestimonials");
function applyTestimonialTone(core, angle, variant = 0) {
  const c = core ? core.toLowerCase() : "result";
  switch (variant) {
    case 1:
      return `we ended up with ${c} that ${angle}`;
    case 2:
      return `${c} that felt consistent and well thought out from start to finish`;
    default:
      return `the final ${c} ${angle}`;
  }
}
__name(applyTestimonialTone, "applyTestimonialTone");
__name2(applyTestimonialTone, "applyTestimonialTone");
function resolveConversionMode(facts) {
  const booking = effectivePublicBookingUrl(cleanString3(facts?.booking_url?.value));
  if (booking) return "booking";
  if (cleanString3(facts?.phone?.value)) return "call";
  if (cleanString3(facts?.email?.value)) return "inquiry";
  return "hybrid";
}
__name(resolveConversionMode, "resolveConversionMode");
__name2(resolveConversionMode, "resolveConversionMode");
function synthesizeCTA(facts, strategy = {}, mode = null) {
  const resolvedMode = mode || resolveConversionMode(facts);
  const offer = extractCoreOutcome(cleanString3(facts?.primary_offer?.value || "")) || "get started";
  const angle = extractValueAngle(cleanString3(facts?.differentiation?.value || ""));
  switch (resolvedMode) {
    case "booking": {
      const link = effectivePublicBookingUrl(cleanString3(facts?.booking_url?.value)) || "#contact";
      const premiumText = `Book ${offer} that ${angle}`;
      const fallbackText = `Book ${offer}`;
      const ctaText = premiumText.length > 48 ? fallbackText : premiumText;
      return {
        text: ctaText,
        link
      };
    }
    case "call":
      return {
        text: "Call Now",
        link: `tel:${cleanString3(facts?.phone?.value || "")}`
      };
    case "inquiry":
      return {
        text: `Request ${offer}`,
        link: "#contact"
      };
    default:
      return {
        text: "Get Started",
        link: "#contact"
      };
  }
}
__name(synthesizeCTA, "synthesizeCTA");
__name2(synthesizeCTA, "synthesizeCTA");
function synthesizeContactSurface(facts) {
  return {
    phone: cleanString3(facts?.phone?.value || ""),
    email: cleanString3(facts?.email?.value || ""),
    address: cleanString3(facts?.address?.value || ""),
    booking_url: cleanString3(facts?.booking_url?.value || "")
  };
}
__name(synthesizeContactSurface, "synthesizeContactSurface");
__name2(synthesizeContactSurface, "synthesizeContactSurface");
function detectFeatureSignals(offer, diff) {
  const text = `${offer} ${diff}`.toLowerCase();
  const signals = [];
  if (/craft|detail|precision|finish|workmanship/i.test(text)) {
    signals.push("craft");
  }
  if (/quality|premium|high[-\s]?end|professional/i.test(text)) {
    signals.push("quality");
  }
  if (/custom|tailor|personalized|bespoke|fit/i.test(text)) {
    signals.push("customization");
  }
  if (/fast|quick|efficient|responsive/i.test(text)) {
    signals.push("speed");
  }
  if (/trusted|local|community|experience|years/i.test(text)) {
    signals.push("trust");
  }
  return [...new Set(signals)];
}
__name(detectFeatureSignals, "detectFeatureSignals");
__name2(detectFeatureSignals, "detectFeatureSignals");
function buildFeatureFromSignal(signal, offer, diff) {
  const core = extractCoreOutcome(offer) || "your project";
  const angle = extractValueAngle(diff);
  switch (signal) {
    case "craft":
      return {
        title: "Precision in Every Detail",
        description: `Handled with care and attention so your ${core.toLowerCase()} reflects true craftsmanship, not rushed work.`
      };
    case "quality":
      return {
        title: "Results You Can Rely On",
        description: `Expect ${applyAngle(core, angle, 0)}, with consistency you can count on.`
      };
    case "customization":
      return {
        title: "No One-Size-Fits-All",
        description: `Your ${core.toLowerCase()} is shaped around your needs, not a preset solution.`
      };
    case "speed":
      return {
        title: "Efficient, Not Rushed",
        description: `Work moves forward quickly while still delivering ${applyAngle(core, angle, 1)}.`
      };
    case "trust":
      return {
        title: "A Process You Feel Good About",
        description: `Clear steps and reliable execution make your ${applyAngle(core, angle, 2)} feel straightforward and stress-free.`
      };
    default:
      return buildFallbackFeature(0, offer);
  }
}
__name(buildFeatureFromSignal, "buildFeatureFromSignal");
__name2(buildFeatureFromSignal, "buildFeatureFromSignal");
function applyAngle(core, angle, variant = 0) {
  const c = core ? core.toLowerCase() : "results";
  switch (variant) {
    case 1:
      return `${c} built to deliver ${angle}`;
    case 2:
      return `${c} designed to ${angle}`;
    default:
      return `${c} that ${angle}`;
  }
}
__name(applyAngle, "applyAngle");
__name2(applyAngle, "applyAngle");
function buildFallbackFeature(index, offer) {
  const core = extractCoreOutcome(offer) || "results";
  const fallback = [
    {
      title: "Reliable Results",
      description: `Focused on delivering ${core.toLowerCase()} you can count on.`
    },
    {
      title: "Clear Communication",
      description: `You'll always understand what's happening with your ${core.toLowerCase()} from start to finish.`
    },
    {
      title: "Client-Focused Approach",
      description: `Everything is built around making your ${core.toLowerCase()} successful.`
    }
  ];
  return fallback[index % fallback.length];
}
__name(buildFallbackFeature, "buildFallbackFeature");
__name2(buildFallbackFeature, "buildFallbackFeature");
function buildPositionedHeadline(offer, diff) {
  if (!offer && !diff) {
    return "Designed to stand out. Built to convert.";
  }
  if (offer && diff) {
    return `${extractCoreOutcome(offer)} that ${extractValueAngle(diff)}`;
  }
  if (offer) {
    return extractCoreOutcome(offer);
  }
  return extractValueAngle(diff);
}
__name(buildPositionedHeadline, "buildPositionedHeadline");
__name2(buildPositionedHeadline, "buildPositionedHeadline");
function extractCoreOutcome(offer) {
  if (!offer) return "";
  return capitalizeFirst(
    offer.split(/[.,]/)[0].replace(/we (do|offer|provide)/i, "").replace(/our services include/i, "").trim()
  );
}
__name(extractCoreOutcome, "extractCoreOutcome");
__name2(extractCoreOutcome, "extractCoreOutcome");
function extractValueAngle(diff) {
  if (!diff) return "sets you apart";
  const d = cleanString3(diff).toLowerCase();
  if (isCraftSignal(d)) return "reflects a high level of craftsmanship";
  if (isQualitySignal(d)) return "delivers consistently strong results";
  if (isAccessibilitySignal(d)) return "keeps quality within reach";
  if (isCustomizationSignal(d)) return "adapts to each situation";
  if (isLocalTrustSignal(d)) return "earns trust locally";
  return "sets you apart";
}
__name(extractValueAngle, "extractValueAngle");
__name2(extractValueAngle, "extractValueAngle");
function isCraftSignal(d) {
  return /craft|detail|precision|finish|workmanship|hand[-\s]?made|care|intent|intentional|driven|focused/i.test(d);
}
__name(isCraftSignal, "isCraftSignal");
__name2(isCraftSignal, "isCraftSignal");
function isQualitySignal(d) {
  return /quality|premium|high[-\s]?end|professional|expert/i.test(d);
}
__name(isQualitySignal, "isQualitySignal");
__name2(isQualitySignal, "isQualitySignal");
function isAccessibilitySignal(d) {
  return /affordable|accessible|budget|value|fair/i.test(d);
}
__name(isAccessibilitySignal, "isAccessibilitySignal");
__name2(isAccessibilitySignal, "isAccessibilitySignal");
function isCustomizationSignal(d) {
  return /custom|tailor|personalized|bespoke|fit/i.test(d);
}
__name(isCustomizationSignal, "isCustomizationSignal");
__name2(isCustomizationSignal, "isCustomizationSignal");
function isLocalTrustSignal(d) {
  return /local|community|trusted|neighborhood|family[-\s]?owned/i.test(d);
}
__name(isLocalTrustSignal, "isLocalTrustSignal");
__name2(isLocalTrustSignal, "isLocalTrustSignal");
function buildBusinessJson(state, strategyContract, strategyBrief) {
  const businessName = cleanString3(state.businessName) || cleanString3(strategyContract.business_context?.business_name) || "Business Name";
  const slug = cleanString3(state.slug) || normalizeSlug(businessName);
  const email = cleanString3(state.clientEmail) || cleanString3(state.answers?.email) || "contact@example.com";
  const phone = cleanString3(state.answers?.phone);
  const bookingUrl = effectivePublicBookingUrl(state.answers?.booking_url);
  const officeAddress = cleanString3(state.answers?.office_address);
  const category = cleanString3(strategyContract.business_context?.category) || "Service business";
  const targetAudience = cleanString3(state.answers?.audience) || cleanString3(strategyContract.audience_model?.primary_persona) || "Customers seeking a trusted provider";
  const tone = cleanString3(state.answers?.tone_of_voice) || inferTone(strategyContract) || "Professional, clear, trustworthy";
  const vibe = selectVibe(SCHEMA_VIBES, strategyContract, state);
  const signalBlob = buildSignalBlob(state, strategyContract);
  const strategyModels = buildStrategyModels(signalBlob);
  const behavior = isObject2(strategyBrief?.derived_behavior) && strategyBrief.derived_behavior ? strategyBrief.derived_behavior : deriveBehavior(signalBlob);
  const trustbar = buildTrustbar(state, strategyContract);
  const factRegistry = isObject2(state?.blueprint?.fact_registry) ? state.blueprint.fact_registry : {};
  const preflightForHero = isObject2(state?.preflight_intelligence) ? state.preflight_intelligence : {};
  let features = synthesizeFeatures(factRegistry);
  features = features.map((f, idx) => ({
    title: normalizePublicText(f.title),
    description: normalizePublicText(f.description),
    icon_slug: pickFeatureIcon(`${f.title} ${f.description}`, idx)
  }));
  let processSteps = buildProcessSteps(state, strategyContract, behavior);
  if (!processSteps.length && strategyModels.process_strategy.type === "consultative") {
    processSteps = strategyModels.process_strategy.steps.map((s) => ({
      title: capitalizeStrategyStep(s),
      description: "We guide you through each step so you feel confident in every decision."
    }));
  }
  processSteps = enhanceProcessSteps(processSteps, signalBlob, behavior).map((s) => ({
    ...s,
    description: normalizePublicText(s.description)
  }));
  let gallery = buildGallery(state, strategyContract, vibe);
  const galleryQueries = buildFallbackGalleryQueries(signalBlob, strategyModels, state, vibe);
  const hasExplicitGallery = Array.isArray(state.answers?.gallery_items) && state.answers.gallery_items.some((x) => isObject2(x)) || cleanList2(state.answers?.gallery_queries).length > 0;
  if (!hasExplicitGallery && Array.isArray(galleryQueries) && galleryQueries.length) {
    gallery = normalizeGalleryShape(
      {
        enabled: true,
        items: galleryQueries.map((q, idx) => ({
          title: galleryTitleFromQuery(q, idx),
          image_search_query: q
        })),
        image_source: { image_search_query: galleryQueries[0] || "" }
      },
      true,
      strategyContract,
      vibe,
      state
    );
  }
  const testimonials = synthesizeTestimonials(factRegistry, signalBlob, behavior);
  const normalizedTestimonials = testimonials.map((t, idx) => ({
    quote: normalizePublicText(truncateAtWordBoundary(t.quote, 180)),
    author: normalizePublicText(t.author || `Client ${idx + 1}`)
  }));
  const faqs = buildFaqs(state, strategyContract);
  const serviceArea = buildServiceArea(state, strategyContract);
  const schemaToggles = isObject2(strategyContract.schema_toggles) ? strategyContract.schema_toggles : {};
  const pi = isObject2(state?.preflight_intelligence) ? state.preflight_intelligence : {};
  const ci = isObject2(pi.component_importance) ? pi.component_importance : {};
  const emPi = isObject2(pi.experience_model) ? pi.experience_model : {};
  const pmPi = isObject2(pi.pricing_model) ? pi.pricing_model : {};
  const toggles = {
    show_trustbar: toggleOptOut(schemaToggles, "show_trustbar", shouldShowTrustbar({ behavior, trustbar })),
    show_about: toggleOptOut(schemaToggles, "show_about", true),
    show_features: toggleOptOut(schemaToggles, "show_features", true),
    show_events: toggleOptOut(
      schemaToggles,
      "show_events",
      piImportanceAtLeast(ci, "events_or_booking", "medium")
    ),
    show_process: toggleOptOut(
      schemaToggles,
      "show_process",
      shouldShowProcess({ behavior, processSteps, componentImportance: ci })
    ),
    show_testimonials: toggleOptOut(
      schemaToggles,
      "show_testimonials",
      shouldShowTestimonials({ behavior, testimonials: normalizedTestimonials, componentImportance: ci }) && normalizedTestimonials.length > 0
    ),
    show_comparison: toggleOptOut(
      schemaToggles,
      "show_comparison",
      piImportanceAtLeast(ci, "comparison", "medium")
    ),
    show_gallery: toggleOptOut(
      schemaToggles,
      "show_gallery",
      shouldShowGallery({ behavior, gallery, experienceModel: emPi }) && Boolean(gallery)
    ),
    show_investment: toggleOptOut(
      schemaToggles,
      "show_investment",
      shouldShowInvestmentSection(state, strategyContract)
    ),
    show_faqs: toggleOptOut(schemaToggles, "show_faqs", shouldShowFaqs({ behavior, faqs }) && faqs.length > 0),
    show_service_area: toggleOptOut(schemaToggles, "show_service_area", Boolean(serviceArea))
  };
  let hero = {
    headline: normalizePublicText(resolveHeroHeadline(state, businessName)),
    subtext: normalizePublicText(resolveHeroSubtext(state, strategyContract)),
    image: {
      alt: normalizePublicText(resolveHeroImageAlt(state, businessName)),
      image_search_query: ""
    }
  };
  hero = enhanceHero(hero, signalBlob, behavior);
  hero.headline = normalizePublicText(hero.headline);
  hero.subtext = normalizePublicText(hero.subtext);
  const heroContent = synthesizeHero(factRegistry, preflightForHero);
  hero.headline = normalizePublicText(truncateAtWordBoundary(heroContent.headline, 120));
  hero.subtext = normalizePublicText(truncateAtWordBoundary(heroContent.subtext, 220));
  if (!cleanString3(hero.headline) && strategyModels.visual_strategy.type === "transformation") {
    hero.headline = normalizePublicText("Designed to showcase and preserve what matters most");
  }
  const heroQuery = buildHeroImageQuery(signalBlob, strategyModels, state, cleanString3(vibe));
  if (!hero.image) hero.image = {};
  hero.image.image_search_query = heroQuery;
  const conversionMode = resolveConversionMode(factRegistry);
  const cta = synthesizeCTA(factRegistry, strategyContract, conversionMode);
  const contactSurface = synthesizeContactSurface(factRegistry);
  const sections = {
    about: true,
    features,
    processSteps,
    testimonials: normalizedTestimonials,
    gallery,
    faqs,
    service_area: serviceArea
  };
  return {
    intelligence: {
      industry: normalizePublicText(category),
      target_persona: normalizePublicText(targetAudience),
      tone_of_voice: normalizePublicText(tone),
      derived_behavior: behavior
    },
    strategy: toggles,
    settings: {
      vibe,
      menu: buildMenu(toggles, sections),
      cta_text: normalizePublicText(cta.text),
      cta_link: cta.link,
      cta_type: inferCtaType(cta.link),
      secondary_cta_text: normalizePublicText(
        inferSecondaryCtaText(strategyContract, phone, normalizePublicText(cta.text))
      ),
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
    hero,
    about: (() => {
      const aboutContent = synthesizeAbout(factRegistry);
      const aboutParagraphs = aboutContent.paragraphs.map(
        (p) => normalizePublicText(truncateAtWordBoundary(p, 240))
      );
      const storyJoin = aboutParagraphs.length >= 2 ? aboutParagraphs.slice(0, -1).join(" ") : aboutParagraphs[0] || "";
      const founderFromSynth = aboutParagraphs.length >= 1 ? aboutParagraphs[aboutParagraphs.length - 1] : "";
      return {
        enabled: true,
        headline: normalizePublicText(aboutContent.headline),
        paragraphs: aboutParagraphs,
        story_text: normalizePublicText(truncateAtWordBoundary(storyJoin, 480)),
        founder_note: normalizePublicText(founderFromSynth),
        years_experience: normalizePublicText(resolveYearsExperience(state, strategyContract))
      };
    })(),
    ...trustbar ? { trustbar } : {},
    features,
    ...processSteps.length ? { processSteps } : {},
    ...gallery ? { gallery } : {},
    contact: {
      headline: "Get in Touch",
      subheadline: normalizePublicText(resolveContactSubheadline(state, strategyContract)),
      email: cleanString3(contactSurface.email) || email,
      phone: cleanString3(contactSurface.phone) || phone,
      email_recipient: cleanString3(contactSurface.email) || email,
      button_text: normalizePublicText(
        inferContactButtonText(
          strategyContract,
          effectivePublicBookingUrl(contactSurface.booking_url) || bookingUrl,
          pmPi,
          emPi,
          state,
          normalizePublicText(cta.text)
        )
      ),
      office_address: normalizePublicText(cleanString3(contactSurface.address) || officeAddress),
      ...effectivePublicBookingUrl(contactSurface.booking_url) ? { booking_url: effectivePublicBookingUrl(contactSurface.booking_url) } : {}
    },
    ...serviceArea ? { service_area: serviceArea } : {},
    ...normalizedTestimonials.length ? { testimonials: normalizedTestimonials } : {},
    ...faqs.length ? { faqs } : {}
  };
}
__name(buildBusinessJson, "buildBusinessJson");
__name2(buildBusinessJson, "buildBusinessJson");
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
  if (toggles.show_service_area && sections.service_area && cleanString3(sections.service_area.main_city)) {
    items.push({ label: "Area", path: "#service-area" });
  }
  items.push({ label: "Contact", path: "#contact" });
  return items.filter((item) => ALLOWED_MENU_PATHS.includes(item.path)).slice(0, 8);
}
__name(buildMenu, "buildMenu");
__name2(buildMenu, "buildMenu");
function buildTrustbar(state, strategyContract) {
  const trustSeeds = uniqueList([
    cleanString3(state.answers?.trust_signal),
    ...cleanList2(strategyContract.proof_model?.trust_signals),
    ...cleanList2(strategyContract.proof_model?.credibility_sources)
  ]).slice(0, 4);
  const items = trustSeeds.map((label, idx) => {
    const normalized = normalizeTrustbarLabel(label);
    if (!normalized) return null;
    return {
      label: normalizePublicText(normalized),
      icon: pickTrustbarIcon(label, idx)
    };
  }).filter(Boolean);
  if (items.length < 2) {
    items.push(
      { label: "Trusted Service", icon: "shield" },
      { label: "Customer Focused", icon: "heart" }
    );
  }
  return items.length ? { enabled: true, items: items.slice(0, 4) } : null;
}
__name(buildTrustbar, "buildTrustbar");
__name2(buildTrustbar, "buildTrustbar");
function buildProcessSteps(state, strategyContract, behavior) {
  const signalBlob = buildSignalBlob(state, strategyContract);
  const b = isObject2(behavior) && behavior ? behavior : deriveBehavior(signalBlob);
  const pi = isObject2(state?.preflight_intelligence) ? state.preflight_intelligence : {};
  const pm = isObject2(pi.process_model) ? pi.process_model : {};
  const ci = isObject2(pi.component_importance) ? pi.component_importance : {};
  const processBoost = piImportanceAtLeast(ci, "process", "medium") || cleanString3(pm.process_narrative).length > 20;
  if (b.complexity === "simple" && !processBoost) {
    return [];
  }
  const source = cleanString3(state.answers?.process_notes) || cleanString3(state.answers?.process_summary);
  let extracted = extractProcessSteps(source);
  if (extracted.length === 2) {
    extracted = [
      ...extracted,
      {
        title: "Confirm the result",
        description: "We verify everything meets your expectations and walk through any final details before we close out."
      }
    ];
  }
  if (extracted.length >= 3) {
    return extracted.slice(0, 5).map((step, idx) => ({
      title: normalizePublicText(step.title || inferProcessStepTitle(step.description, idx)),
      description: normalizePublicText(cleanSentence(step.description))
    }));
  }
  const narrative = cleanString3(pm.process_narrative);
  if (narrative && narrative.length > 40) {
    const sentences = narrative.split(/\.\s+/).map((s) => cleanSentence(s && !/[.!?]$/.test(s.trim()) ? `${s}.` : s)).filter(Boolean).slice(0, 4);
    if (sentences.length >= 3) {
      return sentences.map((desc, idx) => ({
        title: normalizePublicText(inferProcessStepTitle(desc, idx)),
        description: normalizePublicText(desc)
      }));
    }
  }
  const fromPreflight = processShapeFromPreflightModel(pm);
  const shape = fromPreflight || generateProcessShape(b);
  const synthetic = buildSyntheticProcessSteps(shape, b);
  return synthetic.length >= 3 ? synthetic : [];
}
__name(buildProcessSteps, "buildProcessSteps");
__name2(buildProcessSteps, "buildProcessSteps");
function buildGallery(state, strategyContract, vibe) {
  const explicitQueries = cleanList2(state.answers?.gallery_queries);
  const explicitItems = Array.isArray(state.answers?.gallery_items) ? state.answers.gallery_items : [];
  let items = explicitItems.map((item, idx) => {
    if (!isObject2(item)) return null;
    const query = clampWords2(cleanString3(item.image_search_query), 4, 8);
    if (!query) return null;
    return {
      title: normalizePublicText(cleanString3(item.title) || `Project ${idx + 1}`),
      image_search_query: query
    };
  }).filter(Boolean);
  if (!items.length && explicitQueries.length) {
    items = explicitQueries.map((query, idx) => ({
      title: `Project ${idx + 1}`,
      image_search_query: clampWords2(query, 4, 8)
    }));
  }
  if (!items.length) return null;
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
__name(buildGallery, "buildGallery");
__name2(buildGallery, "buildGallery");
function buildFaqs(state, strategyContract) {
  const topics = uniqueList([
    ...cleanList2(state.answers?.common_objections),
    ...cleanList2(state.answers?.buyer_decision_factors),
    ...cleanList2(state.answers?.faq_topics),
    ...cleanList2(state.answers?.faq_angles),
    ...cleanList2(strategyContract.site_structure?.faq_angles),
    ...cleanList2(strategyContract.audience_model?.common_objections),
    ...cleanList2(strategyContract.audience_model?.decision_factors)
  ]).map((item) => normalizeFaqQuestion(item)).filter(Boolean).slice(0, 6);
  return topics.map((question) => ({
    question: ensureQuestion(normalizePublicText(question)),
    answer: normalizePublicText(inferFaqAnswer(question, state, strategyContract))
  }));
}
__name(buildFaqs, "buildFaqs");
__name2(buildFaqs, "buildFaqs");
function buildServiceArea(state, strategyContract) {
  const mainCity = cleanString3(state.answers?.service_area) || cleanList2(strategyContract.business_context?.service_area)[0] || cleanList2(strategyContract.source_snapshot?.nap_recommendation?.service_area)[0];
  if (!mainCity) return null;
  return {
    main_city: normalizePublicText(mainCity),
    surrounding_areas: uniqueList([
      ...cleanList2(state.answers?.service_areas),
      ...cleanList2(strategyContract.business_context?.service_area),
      ...cleanList2(strategyContract.source_snapshot?.nap_recommendation?.service_area)
    ]).filter((value) => value && value !== mainCity).map((value) => normalizePublicText(value)).slice(0, 6)
  };
}
__name(buildServiceArea, "buildServiceArea");
__name2(buildServiceArea, "buildServiceArea");
function resolveTagline(state, strategyContract, businessName) {
  return cleanString3(state.answers?.tagline) || cleanString3(strategyContract.source_snapshot?.primary_offer_hint) || cleanString3(state.answers?.primary_offer) || businessName;
}
__name(resolveTagline, "resolveTagline");
__name2(resolveTagline, "resolveTagline");
function resolveHeroHeadline(state, businessName) {
  return cleanString3(state.ghostwritten?.hero_headline) || cleanString3(state.answers?.hero_headline) || cleanString3(state.answers?.primary_offer) || businessName;
}
__name(resolveHeroHeadline, "resolveHeroHeadline");
__name2(resolveHeroHeadline, "resolveHeroHeadline");
function resolveHeroSubtext(state, strategyContract) {
  return cleanString3(state.ghostwritten?.hero_subheadline) || cleanString3(state.answers?.hero_subheadline) || buildPremiumHeroSubtext(state, strategyContract);
}
__name(resolveHeroSubtext, "resolveHeroSubtext");
__name2(resolveHeroSubtext, "resolveHeroSubtext");
function looksLikeEntityTaxonomyAudience(s) {
  const t = cleanString3(s);
  if (!t) return false;
  return /[·_]|\bvisual\s*portfolio\b|portfolio\s*service|portfolio_service|[a-z]+_[a-z]+/i.test(t) || /\b(entity|taxonomy)[._-]/i.test(t);
}
__name(looksLikeEntityTaxonomyAudience, "looksLikeEntityTaxonomyAudience");
__name2(looksLikeEntityTaxonomyAudience, "looksLikeEntityTaxonomyAudience");
function audienceLabelForHero(state) {
  const hint = cleanString3(state?.preflight_intelligence?.target_persona_hint);
  const aud = cleanString3(state?.answers?.audience);
  if (hint && !looksLikeEntityTaxonomyAudience(hint)) {
    return normalizePublicText(hint);
  }
  if (!aud) return "";
  if (looksLikeEntityTaxonomyAudience(aud)) return "";
  return normalizePublicText(aud.replace(/\s*·\s*/g, " \u2013 ").replace(/_/g, " "));
}
__name(audienceLabelForHero, "audienceLabelForHero");
__name2(audienceLabelForHero, "audienceLabelForHero");
function buildDesignedForOrServingLine(state) {
  const audience = audienceLabelForHero(state);
  const area = cleanString3(state.answers?.service_area);
  if (audience && area) return `Serving ${area} \u2014 built for ${audience}.`;
  if (area) return `Serving ${area}.`;
  if (audience) return `Built for ${audience}.`;
  return "";
}
__name(buildDesignedForOrServingLine, "buildDesignedForOrServingLine");
__name2(buildDesignedForOrServingLine, "buildDesignedForOrServingLine");
function buildPremiumHeroSubtext(state, strategyContract) {
  const differentiation = cleanString3(state.answers?.differentiation);
  const bookingMethod = cleanString3(state.answers?.booking_method);
  const rawA = differentiation ? cleanSentenceFragment(differentiation) : cleanSentenceFragment(cleanString3(state.answers?.website_direction));
  const sentenceA = truncateAtWordBoundary(rawA, 130);
  const sentenceB = buildDesignedForOrServingLine(state);
  const sentenceC = bookingMethod.includes("quote") ? "Start with a quote \u2014 we\u2019ll guide you from there." : bookingMethod.includes("call") ? "Prefer to talk? Call us and we\u2019ll walk you through the next step." : "Reach out and we\u2019ll help you take the next step.";
  return [sentenceA, sentenceB, sentenceC].filter(Boolean).map(cleanSentence).join(" ");
}
__name(buildPremiumHeroSubtext, "buildPremiumHeroSubtext");
__name2(buildPremiumHeroSubtext, "buildPremiumHeroSubtext");
function resolveHeroImageAlt(state, businessName) {
  return cleanString3(state.answers?.hero_image_alt) || cleanString3(state.answers?.primary_offer) || businessName;
}
__name(resolveHeroImageAlt, "resolveHeroImageAlt");
__name2(resolveHeroImageAlt, "resolveHeroImageAlt");
function resolveYearsExperience(state, strategyContract) {
  return normalizeYearsExperience(cleanString3(state.answers?.experience_years)) || normalizeYearsExperience(cleanString3(strategyContract.business_context?.years_experience)) || "Experienced professional service";
}
__name(resolveYearsExperience, "resolveYearsExperience");
__name2(resolveYearsExperience, "resolveYearsExperience");
function resolveContactSubheadline(state, strategyContract) {
  return cleanString3(state.answers?.contact_subheadline) || inferContactSubheadline(state, strategyContract);
}
__name(resolveContactSubheadline, "resolveContactSubheadline");
__name2(resolveContactSubheadline, "resolveContactSubheadline");
function resolveObjectionHandle(state, strategyContract) {
  const first = cleanString3(cleanList2(state.answers?.common_objections)[0]).toLowerCase() || cleanString3(cleanList2(strategyContract.audience_model?.common_objections)[0]).toLowerCase();
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
__name(resolveObjectionHandle, "resolveObjectionHandle");
__name2(resolveObjectionHandle, "resolveObjectionHandle");
function ensureInspirationQueries(data, state, strategyContract) {
  const resolvedVibe = cleanString3(data?.settings?.vibe);
  const signalBlob = buildSignalBlob(state, strategyContract);
  const strategyModels = buildStrategyModels(signalBlob);
  if (!data.hero) data.hero = {};
  if (!data.hero.image) data.hero.image = {};
  data.hero.image.image_search_query = buildHeroImageQuery(
    signalBlob,
    strategyModels,
    state,
    resolvedVibe
  );
  console.log("[FACTORY] Hero query generated:", data.hero.image.image_search_query);
  if (data?.strategy?.show_gallery) {
    data.gallery = data.gallery || { enabled: true, items: [] };
    data.gallery.enabled = true;
    const galleryQueries = buildFallbackGalleryQueries(
      signalBlob,
      strategyModels,
      state,
      resolvedVibe
    );
    const itemsFromFactory = Array.isArray(galleryQueries) && galleryQueries.length ? galleryQueries.map((q, idx) => ({
      title: galleryTitleFromQuery(q, idx),
      image_search_query: q
    })) : [];
    const normalized = normalizeGalleryShape(
      {
        enabled: true,
        items: itemsFromFactory,
        image_source: { image_search_query: itemsFromFactory[0]?.image_search_query || "" }
      },
      true,
      strategyContract,
      resolvedVibe,
      state
    );
    let items = Array.isArray(normalized.items) ? normalized.items : [];
    const count = Number(
      normalized.computed_count || items.length || inferPremiumGalleryCount(strategyContract, state, resolvedVibe)
    );
    const pool = items.map((it) => cleanString3(it?.image_search_query)).filter(Boolean);
    while (items.length < count && pool.length) {
      const idx = items.length;
      items.push({
        title: `Project ${idx + 1}`,
        image_search_query: pool[idx % pool.length]
      });
    }
    data.gallery = {
      ...normalized,
      items: items.map((it, i) => ({
        ...it,
        title: String(it?.title || galleryTitleFromQuery(it?.image_search_query, i))
      }))
    };
    if (!isObject2(data.gallery.image_source)) {
      data.gallery.image_source = {};
    }
    if (!cleanString3(data.gallery.image_source.image_search_query)) {
      data.gallery.image_source.image_search_query = data.gallery.items[0]?.image_search_query || "";
    }
    console.log("[FACTORY] Gallery factory applied, items:", data.gallery.items?.length);
  } else if (data.gallery) {
    data.gallery.enabled = Boolean(data.gallery.enabled);
  }
  return data;
}
__name(ensureInspirationQueries, "ensureInspirationQueries");
__name2(ensureInspirationQueries, "ensureInspirationQueries");
function validateBusinessJson(data) {
  const issues = [];
  const reqTop = ["intelligence", "strategy", "settings", "brand", "hero", "about", "features", "contact"];
  for (const key of reqTop) {
    if (!data?.[key]) issues.push(`Missing top-level "${key}"`);
  }
  for (const key of ["industry", "target_persona", "tone_of_voice"]) {
    if (!cleanString3(data?.intelligence?.[key])) issues.push(`Missing intelligence.${key}`);
  }
  if (!SCHEMA_VIBES.includes(cleanString3(data?.settings?.vibe))) {
    issues.push("settings.vibe must be one of allowed enum values");
  }
  for (const key of ["cta_text", "cta_link", "cta_type"]) {
    if (!cleanString3(data?.settings?.[key])) issues.push(`Missing settings.${key}`);
  }
  if (!Array.isArray(data?.settings?.menu) || !data.settings.menu.length) {
    issues.push("settings.menu must be a non-empty array");
  } else {
    data.settings.menu.forEach((item, idx) => {
      if (!cleanString3(item?.label)) issues.push(`settings.menu[${idx}].label missing`);
      if (!ALLOWED_MENU_PATHS.includes(cleanString3(item?.path))) {
        issues.push(`settings.menu[${idx}].path invalid: ${item?.path}`);
      }
    });
  }
  for (const key of ["name", "tagline", "email"]) {
    if (!cleanString3(data?.brand?.[key])) issues.push(`Missing brand.${key}`);
  }
  for (const key of ["headline", "subtext"]) {
    if (!cleanString3(data?.hero?.[key])) issues.push(`Missing hero.${key}`);
  }
  if (!cleanString3(data?.hero?.image?.alt)) issues.push("Missing hero.image.alt");
  if (!cleanString3(data?.hero?.image?.image_search_query)) issues.push("Missing hero.image.image_search_query");
  for (const key of ["story_text", "founder_note", "years_experience"]) {
    if (!cleanString3(data?.about?.[key])) issues.push(`Missing about.${key}`);
  }
  if (!Array.isArray(data?.features) || data.features.length < 3) {
    issues.push("features must be an array with at least 3 items");
  } else {
    data.features.forEach((item, idx) => {
      for (const key of ["title", "description", "icon_slug"]) {
        if (!cleanString3(item?.[key])) issues.push(`features[${idx}].${key} missing`);
      }
      if (!ALLOWED_ICON_TOKENS.includes(cleanString3(item?.icon_slug))) {
        issues.push(`features[${idx}].icon_slug invalid: ${item?.icon_slug}`);
      }
    });
  }
  for (const key of ["headline", "subheadline", "email_recipient", "button_text"]) {
    if (!cleanString3(data?.contact?.[key])) issues.push(`Missing contact.${key}`);
  }
  if (data?.strategy?.show_gallery) {
    if (!data?.gallery?.enabled) issues.push("strategy.show_gallery=true but gallery.enabled is not true");
    if (!Array.isArray(data?.gallery?.items) || !data.gallery.items.length) {
      issues.push("gallery.items must be a non-empty array when gallery enabled");
    } else {
      data.gallery.items.forEach((item, idx) => {
        if (!cleanString3(item?.title)) issues.push(`gallery.items[${idx}].title missing`);
        if (!cleanString3(item?.image_search_query)) issues.push(`gallery.items[${idx}].image_search_query missing`);
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
__name(validateBusinessJson, "validateBusinessJson");
__name2(validateBusinessJson, "validateBusinessJson");
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
__name(evaluateNarrativeReadiness, "evaluateNarrativeReadiness");
__name2(evaluateNarrativeReadiness, "evaluateNarrativeReadiness");
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
__name(evaluateEnrichment, "evaluateEnrichment");
__name2(evaluateEnrichment, "evaluateEnrichment");
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
__name(getNarrativeModel, "getNarrativeModel");
__name2(getNarrativeModel, "getNarrativeModel");
var BLOCK_MAP = {
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
__name(isBlockSatisfied, "isBlockSatisfied");
__name2(isBlockSatisfied, "isBlockSatisfied");
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
__name(trySubmitBusinessJson, "trySubmitBusinessJson");
__name2(trySubmitBusinessJson, "trySubmitBusinessJson");
function repairProcessTitleTimeUnit(title, sourceText) {
  const t = cleanString3(title);
  const src = cleanString3(sourceText);
  if (!t || !src) return t;
  if (/\d+\s*(days?|hours?|weeks?|minutes?|mins?|hrs?)\b/i.test(t)) return t;
  const m = src.match(/\b(\d+)\s*(days?|hours?|weeks?|minutes?|mins?|hrs?)\b/i);
  if (!m) return t;
  if (/\d\s*$/.test(t) || /\s(in|within|after|for)\s+\d+\s*$/i.test(t)) {
    const merged = `${t} ${m[2]}`.trim();
    if (merged.length <= 72) return merged;
  }
  return t;
}
__name(repairProcessTitleTimeUnit, "repairProcessTitleTimeUnit");
__name2(repairProcessTitleTimeUnit, "repairProcessTitleTimeUnit");
function inferProcessStepTitle(description, idx) {
  const d = cleanString3(description);
  if (!d) return `Step ${idx + 1}`;
  const firstSentence = d.split(/[.!?]/)[0] || d;
  let short = truncateAtWordBoundary(firstSentence, 58).replace(/\s*\.\.\.$/, "");
  short = repairProcessTitleTimeUnit(short, firstSentence);
  return normalizePublicText(titleCaseSmart(short)) || `Step ${idx + 1}`;
}
__name(inferProcessStepTitle, "inferProcessStepTitle");
__name2(inferProcessStepTitle, "inferProcessStepTitle");
function buildVerbatimProcessStepTitle(fragment, idx) {
  const frag = cleanSentenceFragment(fragment);
  if (!frag) return `Step ${idx + 1}`;
  const words = frag.split(/\s+/).filter(Boolean);
  const head = words.slice(0, Math.min(words.length, 12)).join(" ");
  let candidate = truncateAtWordBoundary(head, 64).replace(/\s*\.\.\.$/, "");
  candidate = repairProcessTitleTimeUnit(candidate, frag);
  return normalizePublicText(titleCaseSmart(candidate)) || `Step ${idx + 1}`;
}
__name(buildVerbatimProcessStepTitle, "buildVerbatimProcessStepTitle");
__name2(buildVerbatimProcessStepTitle, "buildVerbatimProcessStepTitle");
function formatProcessStepDescriptionFromFragment(fragment) {
  const frag = cleanSentenceFragment(fragment);
  if (!frag) return "";
  const withStop = /[.!?]$/.test(frag) ? frag : `${frag}.`;
  const cap = withStop.charAt(0).toUpperCase() + withStop.slice(1);
  return normalizePublicText(cap);
}
__name(formatProcessStepDescriptionFromFragment, "formatProcessStepDescriptionFromFragment");
__name2(formatProcessStepDescriptionFromFragment, "formatProcessStepDescriptionFromFragment");
function verbatimStepsFromPieces(pieces) {
  const out = [];
  let idx = 0;
  for (const piece of pieces) {
    const fragment = cleanSentenceFragment(piece);
    if (!fragment) continue;
    const title = buildVerbatimProcessStepTitle(fragment, idx);
    const description = formatProcessStepDescriptionFromFragment(fragment);
    if (!description) continue;
    out.push({
      title,
      description
    });
    idx++;
  }
  return out;
}
__name(verbatimStepsFromPieces, "verbatimStepsFromPieces");
__name2(verbatimStepsFromPieces, "verbatimStepsFromPieces");
function extractProcessSteps(text) {
  const raw = cleanString3(text);
  if (!raw) return [];
  const normalized = raw.replace(/from first contact to finished result/gi, "").replace(/\bthen\b/gi, " | ").replace(/\band do a final walkthrough if needed\b/gi, " | final walkthrough").replace(/\band\b/gi, " | ").replace(/,/g, " | ").replace(/\./g, " | ");
  const pieces = normalized.split(/\|/).map((part) => cleanSentenceFragment(part)).filter(Boolean);
  const canonical = [];
  const seen = /* @__PURE__ */ new Set();
  for (const piece of pieces) {
    const lower = piece.toLowerCase();
    const step = lower.includes("quote") ? { title: "Request a Quote", description: "Reach out with the details and get a quote based on the scope of work." } : lower.includes("scope") || lower.includes("confirm") ? { title: "Confirm the Scope", description: "Review the property, expectations, and any details that matter before the work begins." } : lower.includes("schedule") ? { title: "Schedule the Service", description: "Choose the right time and confirm the details so everything feels organized." } : lower.includes("clean") || lower.includes("work") ? { title: "Complete the Work", description: "Carry out the cleaning carefully with attention to detail and presentation." } : lower.includes("walkthrough") || lower.includes("final") ? { title: "Final Review", description: "Make sure the finished result looks right and the experience ends cleanly." } : null;
    if (step && !seen.has(step.title.toLowerCase())) {
      seen.add(step.title.toLowerCase());
      canonical.push(step);
    }
  }
  if (canonical.length >= 3) {
    return canonical.slice(0, 5);
  }
  if (pieces.length >= 3 && canonical.length === 0) {
    return verbatimStepsFromPieces(pieces).slice(0, 5);
  }
  if (pieces.length >= 3 && canonical.length > 0 && canonical.length < 3) {
    return verbatimStepsFromPieces(pieces).slice(0, 5);
  }
  return canonical;
}
__name(extractProcessSteps, "extractProcessSteps");
__name2(extractProcessSteps, "extractProcessSteps");
function galleryTitleFromQuery(query, idx) {
  const q = cleanString3(query).toLowerCase();
  if (q.includes("before after")) return "Before & After";
  if (q.includes("detail")) return "Detail Work";
  if (q.includes("exterior")) return "Exterior Results";
  if (q.includes("lifestyle")) return "On-Site Service";
  if (q.includes("modern home")) return "Residential Project";
  return `Project ${idx + 1}`;
}
__name(galleryTitleFromQuery, "galleryTitleFromQuery");
__name2(galleryTitleFromQuery, "galleryTitleFromQuery");
function getStrategyContract(state) {
  return isObject2(state?.provenance?.strategy_contract) ? state.provenance.strategy_contract : null;
}
__name(getStrategyContract, "getStrategyContract");
__name2(getStrategyContract, "getStrategyContract");
function getCategory(state) {
  const metaCategory = cleanString3(state?.meta?.category).toLowerCase();
  if (metaCategory) return normalizeCategory(metaCategory);
  const contractCategory = cleanString3(
    state?.provenance?.strategy_contract?.business_context?.category
  ).toLowerCase();
  return normalizeCategory(contractCategory || "service");
}
__name(getCategory, "getCategory");
__name2(getCategory, "getCategory");
function normalizeCategory(value) {
  if (!value) return "service";
  if (["event", "events", "tour", "tours", "experience"].includes(value)) return "event";
  if (["coach", "coaching", "consultant", "consulting"].includes(value)) return "coach";
  if (["portfolio", "creative", "artist", "designer", "photographer"].includes(value)) return "portfolio";
  return "service";
}
__name(normalizeCategory, "normalizeCategory");
__name2(normalizeCategory, "normalizeCategory");
function inferTone(strategyContract) {
  return cleanString3(strategyContract?.source_snapshot?.client_preview?.sales_preview) ? "Premium, confident, trustworthy" : "";
}
__name(inferTone, "inferTone");
__name2(inferTone, "inferTone");
function inferSecondaryCtaText(strategyContract, phone, primaryCtaLabel) {
  const primary = cleanString3(primaryCtaLabel);
  if (primary === "Call Now") {
    return "Learn More";
  }
  const secondary = cleanString3(strategyContract?.conversion_strategy?.secondary_conversion);
  if (phone || secondary === "call_now") return "Call Now";
  if (secondary === "submit_inquiry") return "Send Inquiry";
  if (secondary === "request_quote") return "Request Quote";
  return "Learn More";
}
__name(inferSecondaryCtaText, "inferSecondaryCtaText");
__name2(inferSecondaryCtaText, "inferSecondaryCtaText");
function inferSecondaryCtaLink(phone, bookingUrl) {
  if (phone) return "#contact";
  if (bookingUrl) return bookingUrl;
  return "#about";
}
__name(inferSecondaryCtaLink, "inferSecondaryCtaLink");
__name2(inferSecondaryCtaLink, "inferSecondaryCtaLink");
function inferContactSubheadline(state, strategyContract) {
  const primary = cleanString3(strategyContract?.conversion_strategy?.primary_conversion);
  if (primary === "call_now") return "Call today and we\u2019ll help you figure out the best next step.";
  if (primary === "book_now") return "Ready to get started? Reach out and we\u2019ll help you book the right next step.";
  return "Tell us what you need and we\u2019ll help you with the right next step.";
}
__name(inferContactSubheadline, "inferContactSubheadline");
__name2(inferContactSubheadline, "inferContactSubheadline");
function inferContactButtonText(strategyContract, bookingUrl, pricingModel, experienceModel, state, primaryCtaLabel) {
  const pm = isObject2(pricingModel) ? pricingModel : {};
  const em = isObject2(experienceModel) ? experienceModel : {};
  const risk = cleanString3(pm.risk_language).toLowerCase();
  const pb = cleanString3(em.pricing_behavior).toLowerCase();
  if (risk.includes("prefer_no_public") || pb.includes("consultation_first") || pb.includes("quote_after_scope")) {
    return "Request a Consultation";
  }
  const bm = cleanString3(state?.answers?.booking_method).toLowerCase();
  const cp = cleanString3(state?.answers?.contact_path).toLowerCase();
  if (!bookingUrl && (bm.includes("call") || cp === "call")) {
    return cleanString3(primaryCtaLabel) === "Call Now" ? "Send Message" : "Call Now";
  }
  const primary = cleanString3(strategyContract?.conversion_strategy?.primary_conversion);
  if (bookingUrl || primary === "book_now") return "Book Now";
  if (primary === "call_now") return "Call Now";
  if (primary === "request_quote") return "Request Quote";
  return "Send Message";
}
__name(inferContactButtonText, "inferContactButtonText");
__name2(inferContactButtonText, "inferContactButtonText");
function inferFaqAnswer(question, state, strategyContract) {
  const bookingMethod = cleanString3(state.answers?.booking_method).toLowerCase();
  const serviceArea = cleanString3(state.answers?.service_area);
  const pricing = cleanString3(state.answers?.pricing_structure);
  const processNotes = cleanString3(state.answers?.process_notes);
  const trust = cleanString3(state.answers?.trust_signal);
  const lower = cleanString3(question).toLowerCase();
  if (lower.includes("book") || lower.includes("schedule")) {
    if (bookingMethod.includes("book")) return "Use the booking link to choose the best next step and timing.";
    if (bookingMethod.includes("call")) return "Call directly and we\u2019ll help you schedule the right next step.";
    if (bookingMethod.includes("quote")) return "Start with a quote request and we\u2019ll help you confirm the scope before scheduling.";
    return "Reach out through the contact form and we\u2019ll help guide you from there.";
  }
  if (lower.includes("area") || lower.includes("location")) {
    return serviceArea ? `We primarily serve ${serviceArea}. Reach out if you want to confirm your location.` : "Reach out to confirm service availability in your area.";
  }
  if (lower.includes("price") || lower.includes("cost")) {
    return pricing ? cleanSentence(pricing) : "Pricing depends on the scope of work, and we\u2019ll help guide you to the right fit with a clear quote.";
  }
  if (lower.includes("trust")) {
    return trust ? `We focus on ${trust.toLowerCase()} and a professional customer experience so the service feels easy to trust.` : "We aim to make the experience feel clear, professional, and dependable from the first interaction.";
  }
  if (lower.includes("process")) {
    return processNotes ? "The process is designed to feel clear and well-managed, from the first quote request through the final result." : "We aim to keep the process clear, responsive, and easy from first contact to final follow-through.";
  }
  if (lower.includes("streak-free") || lower.includes("results")) {
    return "Attention to detail, careful technique, and a quality-first approach help deliver a cleaner final result.";
  }
  if (lower.includes("advance") || lower.includes("availability")) {
    return "Availability depends on the schedule and season, so reaching out early is the best way to lock in the timing you want.";
  }
  return "We keep the experience clear, helpful, and easy to understand.";
}
__name(inferFaqAnswer, "inferFaqAnswer");
__name2(inferFaqAnswer, "inferFaqAnswer");
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
  const computed_layout = gg.computed_layout || galleryLayoutFromSignals(strategyContract);
  const computed_count = gg.computed_count || items.length || inferPremiumGalleryCount(strategyContract, state, vibe);
  return {
    enabled,
    title: gg.title || "Gallery",
    layout: gg.layout ?? null,
    show_titles: gg.show_titles ?? true,
    image_source: isObject2(gg.image_source) ? gg.image_source : { image_search_query: "" },
    computed_count: enabled ? computed_count : gg.computed_count ?? null,
    computed_layout: enabled ? computed_layout : gg.computed_layout ?? null,
    items
  };
}
__name(normalizeGalleryShape, "normalizeGalleryShape");
__name2(normalizeGalleryShape, "normalizeGalleryShape");
function normalizeTrustbarLabel(label) {
  const value = cleanString3(label).toLowerCase();
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
__name(normalizeTrustbarLabel, "normalizeTrustbarLabel");
__name2(normalizeTrustbarLabel, "normalizeTrustbarLabel");
function normalizeFaqQuestion(text) {
  const value = cleanString3(text).toLowerCase();
  if (!value) return "";
  if (value.includes("cost concern") || value === "cost concerns") return "How does pricing work?";
  if (value.includes("trustworth")) return "How do I know I can trust your service?";
  if (value.includes("availability")) return "How far in advance should I schedule?";
  return cleanString3(text);
}
__name(normalizeFaqQuestion, "normalizeFaqQuestion");
__name2(normalizeFaqQuestion, "normalizeFaqQuestion");
function normalizeYearsExperience(value) {
  const text = cleanString3(value);
  if (!text) return "";
  if (/\byear/i.test(text)) return text;
  if (/^\d+$/.test(text)) return `${text} years of experience`;
  return text;
}
__name(normalizeYearsExperience, "normalizeYearsExperience");
__name2(normalizeYearsExperience, "normalizeYearsExperience");
function normalizeShortTitle(text, idx) {
  const cleaned = cleanString3(text).replace(/[|,:;]+/g, " ").replace(/\bspecializing in\b/gi, " ").replace(/\bin\s+[A-Z][^,.]*$/g, "").replace(/\b(and|the|a|an|of|for|with|who)\b/gi, " ").replace(/\s{2,}/g, " ").trim();
  const words = cleaned.split(/\s+/).filter(Boolean).slice(0, 5);
  return titleCaseSmart(words.join(" ")) || `Item ${idx + 1}`;
}
__name(normalizeShortTitle, "normalizeShortTitle");
__name2(normalizeShortTitle, "normalizeShortTitle");
function pickTrustbarIcon(text, idx) {
  const value = cleanString3(text).toLowerCase();
  if (value.includes("testimonial") || value.includes("review")) return "star";
  if (value.includes("trust") || value.includes("safe")) return "shield";
  if (value.includes("experience") || value.includes("award")) return "award";
  if (value.includes("referral") || value.includes("people")) return "users";
  if (value.includes("local") || value.includes("area")) return "map";
  return ["shield", "star", "award", "heart"][idx % 4];
}
__name(pickTrustbarIcon, "pickTrustbarIcon");
__name2(pickTrustbarIcon, "pickTrustbarIcon");
function pickFeatureIcon(text, idx) {
  const value = cleanString3(text).toLowerCase();
  if (value.includes("fast") || value.includes("speed")) return "zap";
  if (value.includes("team") || value.includes("people")) return "users";
  if (value.includes("local") || value.includes("area")) return "map";
  if (value.includes("trust") || value.includes("safe") || value.includes("reputation")) return "shield";
  if (value.includes("quality") || value.includes("award") || value.includes("detail")) return "award";
  if (value.includes("schedule") || value.includes("time")) return "clock";
  if (value.includes("glass") || value.includes("window")) return "sparkles";
  return ["sparkles", "award", "shield", "clock", "heart", "map"][idx % 6];
}
__name(pickFeatureIcon, "pickFeatureIcon");
__name2(pickFeatureIcon, "pickFeatureIcon");
function inferCtaType(link) {
  return String(link || "").startsWith("#") ? "anchor" : "external";
}
__name(inferCtaType, "inferCtaType");
__name2(inferCtaType, "inferCtaType");
function applyEnrichmentSourceFallbacks(next) {
  const a = next.answers;
  if (!isObject2(a)) return;
  const pi = isObject2(next.preflight_intelligence) ? next.preflight_intelligence : {};
  const serviceList = Array.isArray(a.service_list) ? cleanList2(a.service_list) : [];
  if (!cleanString3(a.service_descriptions) && serviceList.length) {
    a.service_descriptions = serviceList.join(" \xB7 ");
  } else if (!cleanString3(a.service_descriptions) && cleanString3(a.primary_offer)) {
    a.service_descriptions = cleanString3(a.primary_offer);
  }
  if (!cleanString3(a.process_notes) && cleanString3(a.process_summary)) {
    a.process_notes = cleanString3(a.process_summary);
  }
  let objections = cleanList2(a.common_objections);
  if (!objections.length) {
    objections = uniqueList([...cleanList2(pi.common_objections), ...cleanList2(pi.weaknesses)]);
  }
  a.common_objections = objections;
  let factors = cleanList2(a.buyer_decision_factors);
  if (!factors.length) {
    factors = cleanList2(pi.buyer_factors);
  }
  a.buyer_decision_factors = factors;
}
__name(applyEnrichmentSourceFallbacks, "applyEnrichmentSourceFallbacks");
__name2(applyEnrichmentSourceFallbacks, "applyEnrichmentSourceFallbacks");
function normalizeState(state) {
  const next = isObject2(state) ? state : {};
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
    service_list: [],
    process_summary: "",
    ...isObject2(next.answers) ? next.answers : {}
  };
  next.ghostwritten = isObject2(next.ghostwritten) ? next.ghostwritten : {};
  next.provenance = isObject2(next.provenance) ? next.provenance : {};
  next.meta = isObject2(next.meta) ? next.meta : {};
  next.readiness = isObject2(next.readiness) ? next.readiness : {};
  next.enrichment = isObject2(next.enrichment) ? next.enrichment : {};
  next.answers.service_areas = cleanList2(next.answers.service_areas);
  next.answers.recommended_focus = cleanList2(next.answers.recommended_focus);
  next.answers.recommended_sections = cleanList2(next.answers.recommended_sections);
  next.answers.faq_angles = cleanList2(next.answers.faq_angles);
  next.answers.aeo_angles = cleanList2(next.answers.aeo_angles);
  next.answers.common_objections = cleanList2(next.answers.common_objections);
  next.answers.buyer_decision_factors = cleanList2(next.answers.buyer_decision_factors);
  next.answers.offerings = cleanList2(next.answers.offerings);
  next.answers.differentiators = cleanList2(next.answers.differentiators);
  next.answers.trust_signals = cleanList2(next.answers.trust_signals);
  next.answers.credibility_factors = cleanList2(next.answers.credibility_factors);
  next.answers.faq_topics = cleanList2(next.answers.faq_topics);
  next.answers.gallery_queries = cleanList2(next.answers.gallery_queries);
  next.answers.testimonials = Array.isArray(next.answers.testimonials) ? next.answers.testimonials : [];
  next.answers.gallery_items = Array.isArray(next.answers.gallery_items) ? next.answers.gallery_items : [];
  applyEnrichmentSourceFallbacks(next);
  next.slug = cleanString3(next.slug);
  next.businessName = cleanString3(next.businessName);
  next.clientEmail = cleanString3(next.clientEmail);
  return next;
}
__name(normalizeState, "normalizeState");
__name2(normalizeState, "normalizeState");
function cleanString3(value) {
  return typeof value === "string" ? value.trim() : "";
}
__name(cleanString3, "cleanString3");
__name2(cleanString3, "cleanString");
function effectivePublicBookingUrl(raw) {
  const u = cleanString3(raw);
  if (!u) return "";
  const lower = u.toLowerCase();
  if (["manual", "none", "n/a", "no"].includes(lower)) return "";
  return /^https?:\/\//i.test(u) ? u : "";
}
__name(effectivePublicBookingUrl, "effectivePublicBookingUrl");
__name2(effectivePublicBookingUrl, "effectivePublicBookingUrl");
function cleanList2(value) {
  if (!Array.isArray(value)) return [];
  return value.map(cleanString3).filter(Boolean);
}
__name(cleanList2, "cleanList2");
__name2(cleanList2, "cleanList");
function uniqueList(values) {
  return Array.from(new Set(cleanList2(values)));
}
__name(uniqueList, "uniqueList");
__name2(uniqueList, "uniqueList");
function hasMeaningfulValue(value) {
  if (Array.isArray(value)) return value.some((item) => hasMeaningfulValue(item));
  if (isObject2(value)) return Object.values(value).some((item) => hasMeaningfulValue(item));
  return cleanString3(String(value || "")) !== "";
}
__name(hasMeaningfulValue, "hasMeaningfulValue");
__name2(hasMeaningfulValue, "hasMeaningfulValue");
function isObject2(value) {
  return !!value && typeof value === "object" && !Array.isArray(value);
}
__name(isObject2, "isObject2");
__name2(isObject2, "isObject");
function normalizePublicText(value) {
  return cleanString3(value).replace(/\u00B7/g, " \u2013 ").replace(/[’‘]/g, "'").replace(/[“”]/g, '"').replace(/[—–]/g, " - ").replace(/…/g, "...").replace(/\uFFFD/g, "").replace(/\s{2,}/g, " ").trim();
}
__name(normalizePublicText, "normalizePublicText");
__name2(normalizePublicText, "normalizePublicText");
function cleanSentence(text) {
  const value = normalizePublicText(cleanString3(text).replace(/^[-–—\d.\s]+/, ""));
  if (!value) return "";
  return /[.!?]$/.test(value) ? value : `${value}.`;
}
__name(cleanSentence, "cleanSentence");
__name2(cleanSentence, "cleanSentence");
function cleanSentenceFragment(text) {
  return normalizePublicText(
    cleanString3(text).replace(/[|]/g, " ").replace(/\s{2,}/g, " ").replace(/[.,;:]+$/g, "").trim()
  );
}
__name(cleanSentenceFragment, "cleanSentenceFragment");
__name2(cleanSentenceFragment, "cleanSentenceFragment");
function titleCaseSmart(text) {
  return cleanString3(text).split(/\s+/).filter(Boolean).map((word, idx) => {
    const lower = word.toLowerCase();
    if (idx > 0 && ["and", "of", "for", "with", "to"].includes(lower)) return lower;
    return lower.charAt(0).toUpperCase() + lower.slice(1);
  }).join(" ");
}
__name(titleCaseSmart, "titleCaseSmart");
__name2(titleCaseSmart, "titleCaseSmart");
function ensureQuestion(text) {
  const q = cleanString3(text);
  if (!q) return "What should I know?";
  return /[?]$/.test(q) ? q : `${q}?`;
}
__name(ensureQuestion, "ensureQuestion");
__name2(ensureQuestion, "ensureQuestion");
function clampWords2(text, min, max) {
  const words = String(text || "").trim().split(/\s+/).filter(Boolean);
  if (words.length <= max && words.length >= min) return words.join(" ");
  if (words.length > max) return words.slice(0, max).join(" ");
  const pad = ["photography", "professional", "high", "quality", "detail"];
  while (words.length < min && pad.length) words.push(pad.shift());
  return words.slice(0, max).join(" ");
}
__name(clampWords2, "clampWords2");
__name2(clampWords2, "clampWords");
function normalizeSlug(s) {
  return String(s || "").toLowerCase().replace(/'/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}
__name(normalizeSlug, "normalizeSlug");
__name2(normalizeSlug, "normalizeSlug");
async function readJson(request) {
  const text = await request.text();
  try {
    return JSON.parse(text || "{}");
  } catch {
    throw new Error("Invalid JSON payload");
  }
}
__name(readJson, "readJson");
__name2(readJson, "readJson");
function json2(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" }
  });
}
__name(json2, "json2");
__name2(json2, "json");
var DEFAULT_OPENAI_MODEL = "gpt-4.1-mini";
var INFERRED_FACT_COMPLETE_THRESHOLD = 0.8;
var ALLOWED_ICON_TOKENS2 = [
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
function hasVisualInferenceSignals(factRegistry) {
  const rf = factRegistry?.recommended_focus?.value;
  const diff = factRegistry?.differentiation?.value;
  const cat = factRegistry?.category?.value || factRegistry?.industry?.value;
  return Boolean(
    Array.isArray(rf) && rf.length > 0 || typeof rf === "string" && rf.length > 0 || diff && diff.length > 0 || cat && cat.length > 0
  );
}
__name(hasVisualInferenceSignals, "hasVisualInferenceSignals");
__name2(hasVisualInferenceSignals, "hasVisualInferenceSignals");
function evidenceKeyNeedsEvidence(fieldKey, factRegistry) {
  if ((fieldKey === "image_themes" || fieldKey === "gallery_visual_direction") && hasVisualInferenceSignals(factRegistry)) {
    return false;
  }
  const fact = factRegistry?.[fieldKey];
  if (fieldKey === "booking_url" && fact && isBookingUrlResolved(fact)) {
    return false;
  }
  const status = cleanString4(fact?.status);
  return !hasMeaningfulValue2(fact?.value) || status === "missing" || status === "seeded" || status === "inferred";
}
__name(evidenceKeyNeedsEvidence, "evidenceKeyNeedsEvidence");
__name2(evidenceKeyNeedsEvidence, "evidenceKeyNeedsEvidence");
function isEvidenceKeyPresentForComponentStates(fieldKey, factRegistry) {
  return !evidenceKeyNeedsEvidence(fieldKey, factRegistry);
}
__name(isEvidenceKeyPresentForComponentStates, "isEvidenceKeyPresentForComponentStates");
__name2(isEvidenceKeyPresentForComponentStates, "isEvidenceKeyPresentForComponentStates");
var __debugBlueprintSeq = 0;
function assignDebugBlueprintId(nextBlueprint) {
  if (!nextBlueprint || typeof nextBlueprint !== "object") return;
  nextBlueprint._debug_id = `bp_${Date.now()}_${(++__debugBlueprintSeq).toString(36)}`;
}
__name(assignDebugBlueprintId, "assignDebugBlueprintId");
__name2(assignDebugBlueprintId, "assignDebugBlueprintId");
function debugBlueprintIdentity(label, bp) {
  if (!bp) return;
  console.log(`
\u{1F50D} [BP:${label}]`);
  console.log("id:", bp._debug_id || "(none)");
  console.log("primary_field:", bp?.question_plan?.primary_field);
  console.log("booking_url:", bp?.fact_registry?.booking_url);
}
__name(debugBlueprintIdentity, "debugBlueprintIdentity");
__name2(debugBlueprintIdentity, "debugBlueprintIdentity");
function debugSatisfaction(field, fact, fn) {
  console.log(`
\u{1F9EA} [SATISFACTION CHECK] ${field}`);
  console.log("value:", fact?.value);
  console.log("status:", fact?.status);
  try {
    console.log("result:", fn(fact, field));
  } catch (e) {
    console.log("result: ERROR", e.message);
  }
}
__name(debugSatisfaction, "debugSatisfaction");
__name2(debugSatisfaction, "debugSatisfaction");
async function onRequestPost3(context) {
  const { request, env } = context;
  try {
    const body = await readJson2(request);
    const userAnswer = cleanString4(body.answer);
    const incomingState = normalizeState2(deepClone(body.state || {}));
    if (!incomingState.provenance?.strategy_contract) {
      throw new Error("Missing strategy_contract - run intake-start-v2 first");
    }
    if (!isObject3(incomingState.blueprint)) {
      throw new Error("Missing blueprint - run intake-start-v2 first");
    }
    if (!userAnswer) {
      return json3({ ok: false, error: "Missing answer" }, 400);
    }
    const state = normalizeState2(incomingState);
    state.conversation.push({
      role: "user",
      content: userAnswer
    });
    const blueprint = normalizeBlueprint(state.blueprint);
    const currentPlan = isObject3(blueprint.question_plan) ? blueprint.question_plan : {};
    const schemaGuide = compileSchemaGuide(blueprint, state);
    debugBlueprintIdentity("before_route", blueprint);
    const interpretation = await interpretUserAnswer({
      env,
      answer: userAnswer,
      blueprint,
      state,
      schemaGuide,
      currentPlan
    });
    const routed = routeInterpretationToEvidence({
      blueprint,
      state,
      schemaGuide,
      interpretation,
      answer: userAnswer
    });
    debugBlueprintIdentity("after_route", routed.blueprint);
    const recomputed = recomputeBlueprint({
      blueprint: routed.blueprint,
      state,
      schemaGuide,
      previousPlan: currentPlan,
      lastAudit: routed.audit
    });
    debugBlueprintIdentity("after_recompute", recomputed.blueprint);
    const pf = cleanString4(currentPlan?.primary_field);
    if (pf) {
      debugSatisfaction(pf, recomputed.blueprint?.fact_registry?.[pf], isFactComplete);
    }
    const expectedField = cleanString4(recomputed.blueprint?.question_plan?.primary_field);
    if (expectedField && isFactComplete(
      recomputed.blueprint?.fact_registry?.[expectedField],
      expectedField
    ) && recomputed.blueprint?.question_plan?.primary_field === expectedField) {
      console.error("\u{1F6A8} INVARIANT VIOLATION:");
      console.error("Field is complete but still selected as primary:", expectedField);
    }
    state.blueprint = {
      ...recomputed.blueprint,
      schema_guide: schemaGuide,
      last_answer: {
        text: userAnswer,
        bundle_id: cleanString4(currentPlan.bundle_id),
        primary_field: cleanString4(currentPlan.primary_field),
        timestamp: (/* @__PURE__ */ new Date()).toISOString()
      },
      last_interpretation: routed.audit
    };
    syncCompatibilityMirrors(state);
    state.readiness = evaluateBlueprintReadiness(state.blueprint);
    const combinedAnswerForReinforcement = `${userAnswer} ${cleanString4(routed.audit?.answer_summary)}`.trim();
    const reinforcementEval = evaluatePositiveReinforcement({
      combinedAnswer: combinedAnswerForReinforcement,
      preflightIntelligence: state.preflight_intelligence,
      lastTurnReinforcementSource: cleanString4(state.meta?.last_turn_reinforcement_source)
    });
    state.reinforcement = reinforcementEval ? {
      type: reinforcementEval.type,
      message: reinforcementEval.message,
      source: reinforcementEval.source
    } : null;
    state.meta = isObject3(state.meta) ? state.meta : {};
    state.meta.last_turn_reinforcement_source = reinforcementEval ? reinforcementEval.source : null;
    state.phase = state.readiness.can_generate_now ? "intake_complete" : "blueprint_verify";
    state.action = state.readiness.can_generate_now ? "complete" : "continue";
    if (state.action === "complete") {
      state.blueprint.question_plan = null;
    }
    state.current_key = cleanString4(state.blueprint.question_plan?.primary_field);
    let assistantMessage = "";
    let questionRenderMeta = {
      fallback_triggered: false,
      llm_available: !!env?.OPENAI_API_KEY,
      question_source: "intake_complete",
      fallback_reason: null,
      preflight_bridge_framing: null,
      question_render_mode: null
    };
    if (state.action === "complete") {
      assistantMessage = buildCompletionMessage(state.businessName, state.readiness);
    } else {
      const rendered = await renderNextQuestion({
        env,
        blueprint: state.blueprint,
        previousPlan: currentPlan,
        interpretation: routed.audit,
        businessName: state.businessName,
        preflightIntelligence: state.preflight_intelligence
      });
      assistantMessage = rendered.message;
      questionRenderMeta = {
        fallback_triggered: rendered.fallback_triggered,
        llm_available: rendered.llm_available,
        question_source: rendered.question_source,
        fallback_reason: rendered.fallback_reason ?? null,
        preflight_bridge_framing: rendered.preflight_bridge_framing ?? null,
        question_render_mode: rendered.question_render_mode ?? "rephrase_only"
      };
    }
    assistantMessage = appendReinforcementToAssistantMessage(state.reinforcement, assistantMessage);
    state.conversation.push({
      role: "assistant",
      content: assistantMessage
    });
    const answeredPf = cleanString4(currentPlan.primary_field);
    const pr = state.blueprint.premium_readiness;
    const ar = state.blueprint.access_readiness;
    const debugRegistry = safeObject(recomputed.blueprint.fact_registry);
    state.turn_debug = {
      answered_primary_field: answeredPf || null,
      primary_satisfied_after_answer: answeredPf ? isFieldSatisfied(answeredPf, debugRegistry) : null,
      next_primary_field: cleanString4(state.blueprint.question_plan?.primary_field) || null,
      next_bundle_id: cleanString4(state.blueprint.question_plan?.bundle_id) || null,
      updated_fact_keys: cleanList3(routed.audit?.updated_fact_keys),
      secondary_updated_keys: cleanList3(routed.audit?.secondary_updated_keys),
      primary_field_updated: !!routed.audit?.primary_field_updated,
      fallback_triggered: questionRenderMeta.fallback_triggered,
      llm_available: questionRenderMeta.llm_available,
      question_source: questionRenderMeta.question_source,
      fallback_reason: questionRenderMeta.fallback_reason,
      preflight_bridge_framing: questionRenderMeta.preflight_bridge_framing ?? null,
      preflight_intelligence_keys: listPreflightIntelligenceKeys(state.preflight_intelligence),
      question_render_mode: questionRenderMeta.question_render_mode ?? null,
      reinforcement_triggered: !!state.reinforcement,
      reinforcement_type: state.reinforcement ? "alignment" : null,
      reinforcement_source: state.reinforcement?.source ?? null,
      premium_next_unlock: pr?.next_unlock || null,
      premium_avg_score: pr?.summary?.avg_score ?? null,
      access_model: ar?.model ?? null,
      access_satisfied: ar?.satisfied ?? null,
      access_score: ar?.score ?? null,
      access_planner_hint: ar?.planner_hint ?? null,
      access_model_source: ar?.access_model_source ?? null,
      business_model_signal: ar?.business_model_signal ?? null,
      // ==========================
      // PHASE 1 — OBSERVABILITY (NON-BREAKING)
      // ==========================
      why_this_field: cleanString4(state?.blueprint?.question_plan?.selection_reason) || "first_missing",
      field_priority_score: state?.blueprint?.question_plan?.priority_score ?? null,
      preflight_signal_used: Array.isArray(state?.blueprint?.question_plan?.preflight_signals_used) ? [...state.blueprint.question_plan.preflight_signals_used] : [],
      cluster_active: false,
      cluster_fields: []
    };
    state.blueprint.question_history = Array.isArray(state.blueprint.question_history) ? state.blueprint.question_history : [];
    state.blueprint.question_history.push({
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      bundle_id: cleanString4(state.blueprint.question_plan?.bundle_id),
      primary_field: cleanString4(state.blueprint.question_plan?.primary_field),
      message: assistantMessage
    });
    return json3({
      ok: true,
      message: assistantMessage,
      state
    });
  } catch (err) {
    console.error("[intake-next-v2-1]", err);
    return json3(
      {
        ok: false,
        error: String(err?.message || err || "Unknown error")
      },
      500
    );
  }
}
__name(onRequestPost3, "onRequestPost3");
__name2(onRequestPost3, "onRequestPost");
async function onRequestGet3() {
  return json3({
    ok: true,
    endpoint: "intake-next-v2-1",
    method: "POST",
    version: "v2.1-component-first-rebuilt"
  });
}
__name(onRequestGet3, "onRequestGet3");
__name2(onRequestGet3, "onRequestGet");
function compileSchemaGuide(blueprint, state) {
  const strategyContract = safeObject(state?.provenance?.strategy_contract);
  const toggles = safeObject(
    blueprint?.strategy?.schema_toggles || strategyContract?.schema_toggles
  );
  return {
    intelligence: {
      kind: "section",
      required: true,
      ai_priority: "critical",
      purpose: "Establish foundational context so AI can behave like a web strategist.",
      evidence_keys: ["industry", "target_persona", "tone_of_voice"],
      toggle_key: null
    },
    strategy: {
      kind: "section",
      required: true,
      ai_priority: "critical",
      purpose: "Determine which site components should render based on business needs.",
      evidence_keys: [
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
        "show_service_area"
      ],
      toggle_key: null
    },
    settings: {
      kind: "section",
      required: true,
      ai_priority: "critical",
      purpose: "Control global UI, vibe, CTA, and navigation behavior.",
      evidence_keys: ["vibe", "cta_text", "cta_link", "booking_url"],
      toggle_key: null
    },
    brand: {
      kind: "section",
      required: true,
      ai_priority: "critical",
      purpose: "Define the public-facing identity of the business.",
      evidence_keys: ["business_name", "tagline", "email", "phone", "address"],
      toggle_key: null
    },
    hero: {
      kind: "component",
      required: true,
      ai_priority: "critical",
      planner_group: "positioning",
      purpose: "Immediately communicate the core value proposition.",
      evidence_keys: [
        "primary_offer",
        "target_persona",
        "differentiation",
        "booking_method",
        "hero_headline",
        "hero_subheadline",
        "hero_image_alt",
        "hero_image_query"
      ],
      image_priority: true,
      toggle_key: null
    },
    about: {
      kind: "component",
      required: false,
      ai_priority: "recommended",
      planner_group: "story",
      purpose: "Build emotional connection and credibility through story.",
      evidence_keys: ["founder_story", "years_experience", "differentiation", "business_understanding"],
      toggle_key: "show_about"
    },
    trustbar: {
      kind: "component",
      required: false,
      ai_priority: "optional",
      planner_group: "proof",
      purpose: "Add quick trust signals near the hero to improve conversion.",
      evidence_keys: ["trust_signal", "review_quotes", "years_experience"],
      toggle_key: "show_trustbar"
    },
    events: {
      kind: "component",
      required: false,
      ai_priority: "optional",
      planner_group: "events_strategy",
      purpose: "Display time-based offerings or upcoming schedule.",
      evidence_keys: ["events", "booking_url", "booking_method"],
      toggle_key: "show_events"
    },
    service_area: {
      kind: "component",
      required: false,
      ai_priority: "optional",
      planner_group: "service_area",
      purpose: "Local SEO and trust section for primary city and nearby areas.",
      evidence_keys: ["service_area_main", "surrounding_cities", "service_area_list"],
      toggle_key: "show_service_area"
    },
    features: {
      kind: "component",
      required: true,
      ai_priority: "critical",
      planner_group: "positioning",
      purpose: "Explain what the business offers and why it matters.",
      evidence_keys: ["primary_offer", "service_list", "differentiation"],
      toggle_key: null
    },
    processSteps: {
      kind: "component",
      required: false,
      ai_priority: "optional",
      planner_group: "process",
      purpose: "Explain the workflow in clear steps to reduce friction.",
      evidence_keys: ["process_summary"],
      toggle_key: "show_process"
    },
    testimonials: {
      kind: "component",
      required: false,
      ai_priority: "recommended",
      planner_group: "proof",
      purpose: "Reduce risk and increase trust with social proof.",
      evidence_keys: ["review_quotes", "trust_signal"],
      toggle_key: "show_testimonials"
    },
    comparison: {
      kind: "component",
      required: false,
      ai_priority: "optional",
      planner_group: "comparison_strategy",
      purpose: "Help buyers decide by comparing the offer to alternatives.",
      evidence_keys: ["comparison", "differentiation", "trust_signal"],
      toggle_key: "show_comparison"
    },
    investment: {
      kind: "component",
      required: false,
      ai_priority: "optional",
      planner_group: "pricing_model",
      purpose: "Clarify pricing expectations and qualify leads.",
      evidence_keys: ["pricing", "investment"],
      toggle_key: "show_investment"
    },
    faqs: {
      kind: "component",
      required: false,
      ai_priority: "optional",
      planner_group: "objection_handling",
      purpose: "Answer objections and increase conversion confidence.",
      evidence_keys: ["faq_angles", "pricing", "process_summary", "trust_signal"],
      toggle_key: "show_faqs"
    },
    gallery: {
      kind: "component",
      required: false,
      ai_priority: "recommended",
      planner_group: "gallery_strategy",
      purpose: "Render a visual gallery using inferred layout, count, and search query.",
      evidence_keys: ["gallery_visual_direction", "image_themes", "primary_offer", "differentiation"],
      image_priority: true,
      toggle_key: "show_gallery"
    },
    contact: {
      kind: "component",
      required: true,
      ai_priority: "critical",
      planner_group: "contact_details",
      purpose: "Configure the contact section and submission behavior.",
      evidence_keys: ["booking_method", "contact_path", "phone", "email", "address", "hours", "booking_url"],
      toggle_key: null
    },
    _toggles: toggles
  };
}
__name(compileSchemaGuide, "compileSchemaGuide");
__name2(compileSchemaGuide, "compileSchemaGuide");
async function interpretUserAnswer({ env, answer, blueprint, state, schemaGuide, currentPlan }) {
  const allowedFactKeys = Object.keys(blueprint.fact_registry || {});
  const allowedTopLevelSections = Object.keys(blueprint.business_draft || {});
  const allowedLeafPaths = collectLeafPaths(blueprint.business_draft);
  const fallback = {
    ok: true,
    answered_decisions: [cleanString4(currentPlan.bundle_id)].filter(Boolean),
    answer_summary: answer,
    confidence: 0,
    fact_updates: [],
    component_impacts: [],
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
            task: "Interpret the user's answer into safe evidence updates for SiteForge intake-next-v2-1.",
            answer,
            current_bundle_id: cleanString4(currentPlan.bundle_id),
            current_primary_field: cleanString4(currentPlan.primary_field),
            current_target_fields: cleanList3(currentPlan.target_fields),
            interpreter_priority_rule: "Prioritize extracting the current primary field first. Only add off-bundle updates if they are explicit and clearly supported.",
            strategy: blueprint.strategy,
            fact_registry_snapshot: pruneFactRegistryForModel(blueprint.fact_registry),
            component_states: blueprint.component_states || {},
            decision_states: blueprint.decision_states || {},
            schema_guide: schemaGuide,
            business_draft_snapshot: blueprint.business_draft,
            allowed_fact_keys: allowedFactKeys,
            allowed_top_level_sections: allowedTopLevelSections,
            allowed_leaf_paths: allowedLeafPaths,
            allowed_icon_tokens: ALLOWED_ICON_TOKENS2,
            strategy_contract_context: {
              business_context: safeObject(state?.provenance?.strategy_contract?.business_context),
              conversion_strategy: safeObject(state?.provenance?.strategy_contract?.conversion_strategy),
              content_requirements: safeObject(state?.provenance?.strategy_contract?.content_requirements),
              schema_toggles: safeObject(state?.provenance?.strategy_contract?.schema_toggles),
              copy_policy: safeObject(state?.provenance?.strategy_contract?.copy_policy)
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
    if (!isObject3(parsed)) return fallback;
    const sanitized = sanitizeInterpretation(parsed, {
      allowedFactKeys,
      allowedTopLevelSections,
      allowedLeafPaths,
      currentPlan,
      schemaGuide
    });
    return repairInterpretationForActiveTarget(sanitized, currentPlan, answer);
  } catch (err) {
    console.error("[intake-next-v2-1:interpret]", err);
    return fallback;
  }
}
__name(interpretUserAnswer, "interpretUserAnswer");
__name2(interpretUserAnswer, "interpretUserAnswer");
function buildInterpreterSystemPrompt() {
  return [
    "You are the interpretation layer for SiteForge Factory intake-next-v2-1.",
    "You do NOT control schema or system logic.",
    "You may ONLY interpret the user's answer into safe updates for existing fact keys and existing business_draft sections.",
    "Do not invent fields.",
    "Do not invent new schema sections.",
    "Do not hardcode industries.",
    "Be conservative and faithful to the user's wording.",
    "",
    "Highest priority: interpret the answer for the current primary_field first.",
    "If the user directly answers the current primary_field, you must include a fact_update for that field.",
    "Do not ignore the current primary_field in favor of adjacent fields.",
    "Only update fields outside the current bundle if the answer clearly and directly provides them.",
    "If the answer is about pricing, prefer pricing over primary_offer.",
    "If the answer is about booking flow, prefer booking_method, booking_url, or contact_path over positioning fields.",
    "If the bundle is contact_details and the user gives phone, address, or hours together, include fact_updates for each distinct field you can extract.",
    "If the answer is about process, prefer process_summary over generic differentiation.",
    "If the answer is about visuals, prefer hero_image_query or gallery_visual_direction.",
    "If the answer is partial, still update the primary field with status='partial' rather than leaving it missing.",
    "If the answer includes feature suggestions that need icon_slug, use only an allowed icon token.",
    "",
    "Return JSON only with this exact shape:",
    "{",
    '  "answered_decisions": ["string"],',
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
    '  "component_impacts": [',
    "    {",
    '      "component": "string",',
    '      "confidence_delta": 0.0,',
    '      "reason": "short reason"',
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
    '  "notes": "string"',
    "}"
  ].join("\n");
}
__name(buildInterpreterSystemPrompt, "buildInterpreterSystemPrompt");
__name2(buildInterpreterSystemPrompt, "buildInterpreterSystemPrompt");
function isFactComplete(fact, key = "") {
  if (!fact) return false;
  if (hasMeaningfulValue2(fact.intake_followup)) return false;
  if (cleanString4(key) === "booking_url" && isBookingUrlResolved(fact)) {
    return true;
  }
  if (cleanString4(key) === "primary_offer") {
    const st = cleanString4(fact.status);
    if (st !== "answered" && st !== "verified") return false;
    const vOffer = sanitizeFactValue(fact.value);
    return hasMeaningfulValue2(vOffer);
  }
  const v = sanitizeFactValue(fact.value);
  if (!hasMeaningfulValue2(v)) return false;
  const status = cleanString4(fact.status);
  const confidence = clampNumber(fact.confidence, 0, 1, 0);
  if (status === "verified" || fact.verified === true) return true;
  if (status === "answered") return true;
  if (status === "inferred" && confidence >= INFERRED_FACT_COMPLETE_THRESHOLD) return true;
  return false;
}
__name(isFactComplete, "isFactComplete");
__name2(isFactComplete, "isFactComplete");
function isManualBookingMethodValue(bookingMethodRaw) {
  const m = cleanString4(bookingMethodRaw).toLowerCase().replace(/\s+/g, "_");
  if (!m) return false;
  const exact = [
    "call",
    "manual",
    "phone",
    "request_quote",
    "call_for_quote",
    "call_to_get_quote",
    "phone_call",
    "quote_by_phone",
    "call_us"
  ];
  if (exact.includes(m)) return true;
  if (m.startsWith("call_")) return true;
  if (m === "phone" || m.startsWith("phone_")) return true;
  if (m.includes("phone") && (m.includes("call") || m.includes("quote"))) return true;
  if (m.includes("call") && m.includes("quote")) return true;
  return false;
}
__name(isManualBookingMethodValue, "isManualBookingMethodValue");
__name2(isManualBookingMethodValue, "isManualBookingMethodValue");
function extractHttpUrlFromText(text) {
  const s = cleanString4(text);
  const m = s.match(/https?:\/\/[^\s)\]]+/i) || s.match(/\bwww\.[^\s)\]]+/i);
  return m ? m[0] : "";
}
__name(extractHttpUrlFromText, "extractHttpUrlFromText");
__name2(extractHttpUrlFromText, "extractHttpUrlFromText");
function isPlausibleBookingUrlString(value) {
  if (!hasMeaningfulValue2(value) || typeof value !== "string") return false;
  const s = value.trim();
  if (extractHttpUrlFromText(s)) return true;
  return /^[a-z0-9][a-z0-9.-]*\.[a-z]{2,}([/?#][^\s]*)?$/i.test(s);
}
__name(isPlausibleBookingUrlString, "isPlausibleBookingUrlString");
__name2(isPlausibleBookingUrlString, "isPlausibleBookingUrlString");
function describesManualBookingNoUrl(lower) {
  const s = cleanString4(lower).toLowerCase().trim();
  if (!s) return false;
  if (s === "none" || s === "nope" || s === "nah" || s === "no") return true;
  const signals = [
    "manual",
    "manually",
    "manuall",
    "handled manually",
    "no booking",
    "no booking link",
    "no booking page",
    "we schedule manually",
    "no url",
    "not online",
    "call only",
    "phone only",
    "request a quote",
    "don't have a link",
    "do not have a link"
  ];
  return signals.some((sig) => s.includes(sig));
}
__name(describesManualBookingNoUrl, "describesManualBookingNoUrl");
__name2(describesManualBookingNoUrl, "describesManualBookingNoUrl");
function isAcceptableBookingUrlFactUpdate(update, rawAnswer) {
  const v = update?.value;
  if (v == null && cleanString4(update?.status) === "answered") return true;
  if (typeof v === "string") {
    const lower = v.toLowerCase();
    if (isPlausibleBookingUrlString(v)) return true;
    if (isBookingUrlNoLinkSentinel(v)) return true;
    if (describesManualBookingNoUrl(lower)) return true;
  }
  const fromUser = cleanString4(rawAnswer).toLowerCase();
  if (fromUser && (describesManualBookingNoUrl(fromUser) || isBookingUrlNoLinkSentinel(fromUser))) return true;
  if (typeof v === "string" && extractHttpUrlFromText(v)) return true;
  return false;
}
__name(isAcceptableBookingUrlFactUpdate, "isAcceptableBookingUrlFactUpdate");
__name2(isAcceptableBookingUrlFactUpdate, "isAcceptableBookingUrlFactUpdate");
function isFieldSatisfied(fieldKey, factRegistry) {
  const fact = factRegistry?.[fieldKey];
  if (fieldKey === "booking_url") {
    const bookingMethod = factRegistry?.booking_method?.value;
    if (isManualBookingMethodValue(bookingMethod)) return true;
    const st = fact ? cleanString4(fact.status) : "";
    const statusAllowsValue = st === "answered" || st === "partial" || st === "inferred" && clampNumber(fact.confidence, 0, 1, 0) >= 0.7;
    if (fact && statusAllowsValue) {
      const v = fact.value;
      if (v == null) return true;
      if (typeof v === "string") {
        const t = v.trim().toLowerCase();
        if (isBookingUrlNoLinkSentinel(v)) return true;
        if (isPlausibleBookingUrlString(v)) return true;
        if (describesManualBookingNoUrl(t)) return true;
      }
      return false;
    }
    return false;
  }
  if (fieldKey === "contact_path") {
    const bookingMethod = factRegistry?.booking_method?.value;
    if (hasMeaningfulValue2(bookingMethod)) {
      return true;
    }
  }
  if ((fieldKey === "image_themes" || fieldKey === "gallery_visual_direction") && hasVisualInferenceSignals(factRegistry)) {
    return true;
  }
  if (fieldKey === "target_persona") {
    if (hasMeaningfulValue2(fact?.intake_followup)) return false;
    const v = sanitizeFactValue(fact?.value);
    if (!hasMeaningfulValue2(v)) return false;
    const st = cleanString4(fact?.status);
    const src = cleanString4(fact?.source);
    if (st === "prefilled_unverified" || st === "seeded") return true;
    if (src === "preflight" && hasMeaningfulValue2(v)) return true;
  }
  return isFactComplete(fact, fieldKey);
}
__name(isFieldSatisfied, "isFieldSatisfied");
__name2(isFieldSatisfied, "isFieldSatisfied");
function isFactUpdateAllowedUnderStrictPrimaryGate(factKey, currentPlan) {
  const fk = cleanString4(factKey);
  const primaryField = cleanString4(currentPlan?.primary_field);
  if (!primaryField) return true;
  if (fk === primaryField) return true;
  const bundleId = cleanString4(currentPlan?.bundle_id);
  if (bundleId === "contact_details" && ["phone", "email", "address", "hours"].includes(fk)) return true;
  return false;
}
__name(isFactUpdateAllowedUnderStrictPrimaryGate, "isFactUpdateAllowedUnderStrictPrimaryGate");
__name2(isFactUpdateAllowedUnderStrictPrimaryGate, "isFactUpdateAllowedUnderStrictPrimaryGate");
function sanitizeInterpretation(parsed, { allowedFactKeys, allowedTopLevelSections, allowedLeafPaths, currentPlan, schemaGuide }) {
  const cleanFactUpdates = (Array.isArray(parsed.fact_updates) ? parsed.fact_updates : []).filter((item) => isObject3(item) && allowedFactKeys.includes(cleanString4(item.fact_key))).map((item) => ({
    fact_key: cleanString4(item.fact_key),
    value: sanitizeFactValue(normalizeModelValue(item.value)),
    confidence: clampNumber(item.confidence, 0, 1, 0.5),
    verified: item.verified !== false,
    status: sanitizeFactStatus(item.status),
    rationale: cleanString4(item.rationale)
  })).filter((item) => isFactUpdateAllowedUnderStrictPrimaryGate(item.fact_key, currentPlan));
  const cleanComponentImpacts = (Array.isArray(parsed.component_impacts) ? parsed.component_impacts : []).filter((item) => isObject3(item) && Object.prototype.hasOwnProperty.call(schemaGuide, cleanString4(item.component))).map((item) => ({
    component: cleanString4(item.component),
    confidence_delta: clampNumber(item.confidence_delta, -1, 1, 0),
    reason: cleanString4(item.reason)
  }));
  const cleanDraftPatches = (Array.isArray(parsed.draft_patches) ? parsed.draft_patches : []).filter((item) => isAllowedDraftPatch(item, allowedTopLevelSections, allowedLeafPaths)).map((item) => ({
    section: cleanString4(item.section),
    path: cleanString4(item.path),
    value: normalizeModelValue(item.value),
    confidence: clampNumber(item.confidence, 0, 1, 0.5),
    rationale: cleanString4(item.rationale)
  }));
  const cleanCopyRefinements = (Array.isArray(parsed.copy_refinements) ? parsed.copy_refinements : []).filter((item) => isAllowedDraftPatch(item, allowedTopLevelSections, allowedLeafPaths)).map((item) => ({
    section: cleanString4(item.section),
    path: cleanString4(item.path),
    value: normalizeModelValue(item.value),
    confidence: clampNumber(item.confidence, 0, 1, 0.5),
    rationale: cleanString4(item.rationale)
  }));
  return {
    ok: true,
    answered_decisions: normalizeStringArray(parsed.answered_decisions),
    answer_summary: cleanString4(parsed.answer_summary),
    confidence: clampNumber(parsed.confidence, 0, 1, 0.5),
    fact_updates: dedupeBy(cleanFactUpdates, "fact_key"),
    component_impacts: dedupeBy(cleanComponentImpacts, "component"),
    draft_patches: dedupeBy(cleanDraftPatches, "path"),
    copy_refinements: dedupeBy(cleanCopyRefinements, "path"),
    unresolved_points: normalizeStringArray(parsed.unresolved_points),
    notes: cleanString4(parsed.notes)
  };
}
__name(sanitizeInterpretation, "sanitizeInterpretation");
__name2(sanitizeInterpretation, "sanitizeInterpretation");
function extractPhoneFromContactAnswer(text) {
  const s = cleanString4(text);
  if (!s) return "";
  const m = s.match(/(?:\+?\d{1,3}[-.\s])?(?:\(?\d{3}\)?)[-.\s]?\d{3}[-.\s]?\d{4}\b/);
  return m ? cleanString4(m[0]) : "";
}
__name(extractPhoneFromContactAnswer, "extractPhoneFromContactAnswer");
__name2(extractPhoneFromContactAnswer, "extractPhoneFromContactAnswer");
function extractStreetAddressFromContactAnswer(text) {
  const s = cleanString4(text);
  if (!s) return "";
  const lineMatch = s.match(
    /\d{1,5}\s+[^\n,]+(?:street|st|avenue|ave|road|rd|blvd|boulevard|drive|dr|lane|ln|way|court|ct|circle|cir)\b[^\n,!?]*/i
  );
  if (lineMatch) return cleanString4(lineMatch[0]);
  const zip = s.match(/\d{1,5}\s+[^,]+,?\s*[A-Za-z.\s]+,?\s*[A-Z]{2}\s*\d{5}(?:-\d{4})?/);
  return zip ? cleanString4(zip[0]) : "";
}
__name(extractStreetAddressFromContactAnswer, "extractStreetAddressFromContactAnswer");
__name2(extractStreetAddressFromContactAnswer, "extractStreetAddressFromContactAnswer");
function extractHoursFromContactAnswer(text) {
  const t = cleanString4(text);
  if (!t) return "";
  const lower = t.toLowerCase();
  const looksTime = /\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday|weekdays|weekends|daily|open|closed)\b/.test(lower) || /\d{1,2}:\d{2}/.test(t) || /\d{1,2}\s*(?:a\.?m\.|p\.?m\.)/i.test(t);
  if (!looksTime) return "";
  return t.length > 280 ? truncate2(t, 280) : t;
}
__name(extractHoursFromContactAnswer, "extractHoursFromContactAnswer");
__name2(extractHoursFromContactAnswer, "extractHoursFromContactAnswer");
function repairContactDetailsComboFacts(repaired, rawAnswer) {
  const text = cleanString4(rawAnswer);
  if (!text) return;
  repaired.fact_updates = repaired.fact_updates || [];
  const keys = new Set(repaired.fact_updates.map((u) => cleanString4(u.fact_key)));
  const push = /* @__PURE__ */ __name2((fact_key, value, rationale) => {
    if (!hasMeaningfulValue2(value) || keys.has(fact_key)) return;
    repaired.fact_updates.push({
      fact_key,
      value,
      confidence: 0.74,
      verified: true,
      status: "answered",
      rationale
    });
    keys.add(fact_key);
  }, "push");
  push("phone", extractPhoneFromContactAnswer(text), "Parsed phone from combined contact reply.");
  push("address", extractStreetAddressFromContactAnswer(text), "Parsed address from combined contact reply.");
  push("hours", extractHoursFromContactAnswer(text), "Parsed hours from combined contact reply.");
}
__name(repairContactDetailsComboFacts, "repairContactDetailsComboFacts");
__name2(repairContactDetailsComboFacts, "repairContactDetailsComboFacts");
function repairInterpretationForActiveTarget(interpretation, currentPlan, answer) {
  const repaired = deepClone(interpretation);
  const primaryField = cleanString4(currentPlan?.primary_field);
  const bundleId = cleanString4(currentPlan?.bundle_id);
  const text = cleanString4(answer);
  const lower = text.toLowerCase();
  if (!primaryField) return repaired;
  const alreadyUpdated = (repaired.fact_updates || []).some(
    (item) => cleanString4(item.fact_key) === primaryField
  );
  if (alreadyUpdated && bundleId !== "contact_details") return repaired;
  if (bundleId === "conversion" && primaryField === "pricing") {
    const pricingSignals = [
      "price",
      "pricing",
      "quote",
      "quoted",
      "estimate",
      "flat rate",
      "starts at",
      "depends on",
      "based on",
      "scope",
      "size",
      "complexity"
    ];
    if (pricingSignals.some((signal) => lower.includes(signal))) {
      repaired.fact_updates = repaired.fact_updates || [];
      repaired.fact_updates.push({
        fact_key: "pricing",
        value: text,
        confidence: 0.72,
        verified: true,
        status: "partial",
        rationale: "User answered the pricing question directly; preserving wording as pricing context."
      });
    }
  }
  if (bundleId === "conversion" && primaryField === "booking_url") {
    const url = extractHttpUrlFromText(text);
    if (url) {
      repaired.fact_updates = repaired.fact_updates || [];
      repaired.fact_updates.push({
        fact_key: "booking_url",
        value: url,
        confidence: 0.88,
        verified: true,
        status: "answered",
        rationale: "User provided a scheduling or booking link."
      });
    } else {
      const manualSignals = [
        "manual",
        "manually",
        "none",
        "handled manually",
        "no booking",
        "no booking link",
        "no booking page",
        "we schedule manually",
        "request a quote"
      ];
      if (manualSignals.some((signal) => lower.includes(signal))) {
        repaired.fact_updates = repaired.fact_updates || [];
        repaired.fact_updates.push({
          fact_key: "booking_url",
          value: "manual",
          confidence: 0.9,
          verified: true,
          status: "answered",
          rationale: "Booking is handled manually; no booking URL exists."
        });
      }
    }
  }
  if (bundleId === "process" && primaryField === "process_summary") {
    if (looksLikeProcessAnswer(lower)) {
      repaired.fact_updates = repaired.fact_updates || [];
      repaired.fact_updates.push({
        fact_key: "process_summary",
        value: text,
        confidence: 0.76,
        verified: true,
        status: "partial",
        rationale: "User described a clear service workflow."
      });
      repaired.component_impacts = repaired.component_impacts || [];
      if (!repaired.component_impacts.some((x) => cleanString4(x.component) === "processSteps")) {
        repaired.component_impacts.push({
          component: "processSteps",
          confidence_delta: 0.28,
          reason: "Process evidence detected from client-described workflow."
        });
      }
    }
  }
  if (bundleId === "gallery_strategy" && (primaryField === "gallery_visual_direction" || primaryField === "hero_image_query")) {
    if (hasMeaningfulValue2(text)) {
      repaired.fact_updates = repaired.fact_updates || [];
      repaired.fact_updates.push({
        fact_key: primaryField,
        value: text,
        confidence: 0.68,
        verified: true,
        status: "partial",
        rationale: "User provided visual direction relevant to image strategy."
      });
    }
  }
  if (bundleId === "contact_details") {
    repairContactDetailsComboFacts(repaired, text);
  }
  repaired.fact_updates = (repaired.fact_updates || []).filter(
    (u) => isFactUpdateAllowedUnderStrictPrimaryGate(u?.fact_key, currentPlan)
  );
  return repaired;
}
__name(repairInterpretationForActiveTarget, "repairInterpretationForActiveTarget");
__name2(repairInterpretationForActiveTarget, "repairInterpretationForActiveTarget");
function maybePromotePrefilledToVerified(answer, fact) {
  if (!isObject3(fact) || cleanString4(fact.status) !== "prefilled_unverified") return fact;
  const text = cleanString4(answer).toLowerCase();
  const isAffirmation = text.includes("yes") || text.includes("correct") || text.includes("looks good") || text.includes("sounds right") || text.includes("that works");
  if (!isAffirmation) return fact;
  return {
    ...fact,
    verified: true,
    status: "answered"
  };
}
__name(maybePromotePrefilledToVerified, "maybePromotePrefilledToVerified");
__name2(maybePromotePrefilledToVerified, "maybePromotePrefilledToVerified");
function isConsultativeExperienceHint(preflightIntelligence) {
  const pi = isObject3(preflightIntelligence) ? preflightIntelligence : {};
  const em = isObject3(pi.experience_model) ? pi.experience_model : {};
  const pt = cleanString4(em.purchase_type).toLowerCase();
  const dm = cleanString4(em.decision_mode).toLowerCase();
  if (pt.includes("consult")) return true;
  if (dm.includes("guided") || dm.includes("appointment") || dm.includes("multi_visit")) return true;
  return false;
}
__name(isConsultativeExperienceHint, "isConsultativeExperienceHint");
__name2(isConsultativeExperienceHint, "isConsultativeExperienceHint");
function computeNarrativeFollowUp(fieldKey, answerText) {
  const fk = cleanString4(fieldKey);
  const t = cleanString4(answerText);
  const lower = t.toLowerCase();
  if (!t) return null;
  if (fk === "process_summary") {
    if (t.length < 20) {
      return "Can you walk me through that in a bit more detail\u2014what actually happens step by step?";
    }
    const processVerbRe = /\b(bring|calls?|calling|choose|choosing|start|starts|walk|walks|help|helps|guide|guides|contact|send|meets?|schedule|scheduling|discuss|finish|completes?|deliver|arrive|order|build|makes?)\b/i;
    if (!processVerbRe.test(lower)) {
      return "Can you walk me through that in a bit more detail\u2014what actually happens step by step?";
    }
    return null;
  }
  if (fk === "target_persona") {
    const trimmed = lower.trim();
    if (/^(everyone|anyone|anybody|all people|all customers|the public|people in general)\b/.test(trimmed) || /\b(everyone|anyone|anybody)\b/.test(lower) && t.length < 48) {
      return "Who do you tend to work with most often in practice?";
    }
    return null;
  }
  if (fk === "primary_offer") {
    const words = t.split(/\s+/).filter(Boolean);
    const hasList = /[,;]| and |\/|\||\b(or|plus)\b/i.test(t);
    if (words.length <= 5 && t.length < 56 && !hasList) {
      return "Can you give me a couple specific examples of what people come to you for?";
    }
    return null;
  }
  if (fk === "faq_angles") {
    const words = t.split(/\s+/).filter(Boolean);
    if (t.length < 22 || words.length < 5) {
      return "What concerns or questions do customers typically have before choosing you\u2014can you add a bit more detail?";
    }
    return null;
  }
  return null;
}
__name(computeNarrativeFollowUp, "computeNarrativeFollowUp");
__name2(computeNarrativeFollowUp, "computeNarrativeFollowUp");
var NARRATIVE_QUALITY_FIELDS = /* @__PURE__ */ new Set(["process_summary", "target_persona", "primary_offer", "faq_angles"]);
function applyNarrativeQualityPass(nextBlueprint, expectedField, answer) {
  const fk = cleanString4(expectedField);
  if (!fk || !NARRATIVE_QUALITY_FIELDS.has(fk) || !hasMeaningfulValue2(answer)) return;
  const fact = nextBlueprint.fact_registry[fk];
  if (!isObject3(fact)) return;
  const text = cleanString4(answer);
  const follow = computeNarrativeFollowUp(fk, text);
  const currentStatus = cleanString4(fact.status);
  if (follow && currentStatus !== "answered" && currentStatus !== "verified") {
    nextBlueprint.fact_registry[fk] = {
      ...fact,
      status: "partial",
      verified: false,
      intake_followup: follow,
      rationale: "Narrative follow-up (light quality pass)."
    };
    return;
  }
  if (hasMeaningfulValue2(fact.intake_followup)) {
    const next = { ...fact };
    delete next.intake_followup;
    if (hasMeaningfulValue2(next.value)) {
      next.status = "answered";
      next.verified = true;
      const prevR = cleanString4(next.rationale);
      next.rationale = prevR && !prevR.includes("Narrative follow-up") ? prevR : "Confirmed after follow-up.";
    }
    nextBlueprint.fact_registry[fk] = next;
  }
}
__name(applyNarrativeQualityPass, "applyNarrativeQualityPass");
__name2(applyNarrativeQualityPass, "applyNarrativeQualityPass");
function isMeaningfulAnswer(value) {
  if (value == null || value === false) return false;
  if (typeof value === "string") {
    const v = value.trim().toLowerCase();
    if (v.length < 8) return false;
    const weakPatterns = [
      "i don't know",
      "not sure",
      "n/a",
      "none",
      "idk",
      "same",
      "whatever"
    ];
    if (weakPatterns.some((p) => v.includes(p))) return false;
  }
  return true;
}
__name(isMeaningfulAnswer, "isMeaningfulAnswer");
__name2(isMeaningfulAnswer, "isMeaningfulAnswer");
function isHighQualityAnswer(fieldKey, value) {
  if (!value || typeof value !== "string") return false;
  const v = value.trim();
  if (v.length < 25) return false;
  if (fieldKey === "differentiation") {
    return v.includes("because") || v.includes("specialize") || v.includes("focus") || v.includes("known for") || v.split(" ").length > 8;
  }
  if (fieldKey === "target_persona") {
    return v.includes("who") || v.includes("clients") || v.includes("customers") || v.split(" ").length > 6;
  }
  if (fieldKey === "primary_offer") {
    return v.split(" ").length > 6;
  }
  return v.length > 30;
}
__name(isHighQualityAnswer, "isHighQualityAnswer");
__name2(isHighQualityAnswer, "isHighQualityAnswer");
function buildFollowupHint(fieldKey) {
  switch (fieldKey) {
    case "differentiation":
      return "Even a rough idea helps \u2014 what do customers usually say you're best at or known for?";
    case "target_persona":
      return "Think about your best customers \u2014 who do you enjoy working with most?";
    case "primary_offer":
      return "What do people usually come to you for \u2014 what's the main thing you help them with?";
    case "booking_method":
      return "For example \u2014 do they call, visit, message, or book online?";
    default:
      return "A quick example or short description is perfect.";
  }
}
__name(buildFollowupHint, "buildFollowupHint");
__name2(buildFollowupHint, "buildFollowupHint");
function appendFollowupHintToQuestion(blueprint, message) {
  if (!isObject3(blueprint) || typeof message !== "string") return message;
  const hint = cleanString4(blueprint.followup_hint);
  if (!hint) return message;
  const base = cleanString4(message);
  if (!base) return message;
  delete blueprint.followup_hint;
  return `${base} ${hint}`;
}
__name(appendFollowupHintToQuestion, "appendFollowupHintToQuestion");
__name2(appendFollowupHintToQuestion, "appendFollowupHintToQuestion");
function routeInterpretationToEvidence({ blueprint, state, schemaGuide, interpretation, answer }) {
  const nextBlueprint = deepClone(blueprint);
  assignDebugBlueprintId(nextBlueprint);
  nextBlueprint.fact_registry = deepClone(blueprint.fact_registry || {});
  nextBlueprint.business_draft = deepClone(blueprint.business_draft || {});
  nextBlueprint.evidence_log = Array.isArray(blueprint.evidence_log) ? deepClone(blueprint.evidence_log) : [];
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const updatedFactKeys = [];
  const patchedPaths = [];
  const expectedField = cleanString4(blueprint?.question_plan?.primary_field);
  function shouldUpdateFact(existing, incoming) {
    if (!existing) return true;
    if (existing.status === "answered" && incoming.status !== "answered") {
      return false;
    }
    if (typeof existing.confidence === "number" && typeof incoming.confidence === "number" && existing.confidence >= 0.85 && incoming.confidence < existing.confidence) {
      return false;
    }
    return true;
  }
  __name(shouldUpdateFact, "shouldUpdateFact");
  __name2(shouldUpdateFact, "shouldUpdateFact");
  const factUpdates = Array.isArray(interpretation?.fact_updates) ? interpretation.fact_updates : [];
  const prioritizedFactUpdates = expectedField ? factUpdates.slice().sort((a, b) => {
    const aIsExpected = cleanString4(a?.fact_key) === expectedField ? 1 : 0;
    const bIsExpected = cleanString4(b?.fact_key) === expectedField ? 1 : 0;
    return bIsExpected - aIsExpected;
  }) : factUpdates;
  for (const update of prioritizedFactUpdates) {
    const fk = cleanString4(update?.fact_key);
    if (!fk) continue;
    if (expectedField && fk !== expectedField) {
      continue;
    }
    if (cleanString4(update.fact_key) === "booking_url" && !isAcceptableBookingUrlFactUpdate(update, answer)) {
      continue;
    }
    const existing = isObject3(nextBlueprint.fact_registry[update.fact_key]) ? nextBlueprint.fact_registry[update.fact_key] : null;
    const existingStatus = cleanString4(existing?.status);
    if (existingStatus === "verified" || existingStatus === "answered") {
      continue;
    }
    const candidateValue = sanitizeFactValue(deepClone(update.value));
    if (fk !== "booking_url" && !isMeaningfulAnswer(candidateValue)) {
      nextBlueprint.followup_hint = buildFollowupHint(fk);
      continue;
    }
    const highQuality = fk === "booking_url" ? false : isHighQualityAnswer(fk, typeof candidateValue === "string" ? candidateValue : "");
    const newFact = {
      value: candidateValue,
      source: "user",
      confidence: highQuality ? 0.95 : 0.8,
      verified: highQuality,
      requires_client_verification: typeof existing?.requires_client_verification === "boolean" ? existing.requires_client_verification && !highQuality : false,
      related_sections: Array.isArray(existing?.related_sections) ? existing.related_sections : [],
      status: highQuality ? "verified" : "answered",
      rationale: cleanString4(update.rationale),
      updated_at: now
    };
    if (fk === "primary_offer") {
      newFact.status = "answered";
      newFact.confidence = 1;
      newFact.verified = true;
      newFact.requires_client_verification = false;
    }
    if (shouldUpdateFact(existing, newFact)) {
      const history = Array.isArray(existing?.history) ? existing.history.slice() : [];
      history.push({
        timestamp: now,
        source: "user",
        previous_value: existing?.value,
        next_value: deepClone(update.value),
        rationale: cleanString4(update.rationale),
        answer_excerpt: truncate2(answer, 400)
      });
      nextBlueprint.fact_registry[update.fact_key] = {
        ...existing,
        ...newFact,
        history
      };
      updatedFactKeys.push(update.fact_key);
    }
  }
  if (expectedField) {
    const fk = expectedField;
    const fact = nextBlueprint.fact_registry[fk];
    if (fact) {
      const promoted = maybePromotePrefilledToVerified(answer, fact);
      if (promoted !== fact) {
        nextBlueprint.fact_registry[fk] = promoted;
        if (!updatedFactKeys.includes(fk)) updatedFactKeys.push(fk);
      }
    }
  }
  if (expectedField) {
    const wasUpdated = updatedFactKeys.includes(expectedField);
    if (!wasUpdated && hasMeaningfulValue2(answer)) {
      if (expectedField === "booking_url") {
        const lower = cleanString4(answer).toLowerCase();
        const url = extractHttpUrlFromText(answer);
        if (url) {
          nextBlueprint.fact_registry.booking_url = {
            value: url,
            status: "answered",
            confidence: 0.85,
            verified: true,
            rationale: "Captured URL from answer (expected field enforcement)",
            updated_at: now
          };
          if (!updatedFactKeys.includes("booking_url")) updatedFactKeys.push("booking_url");
        } else if (describesManualBookingNoUrl(lower) || isBookingUrlNoLinkSentinel(cleanString4(answer))) {
          nextBlueprint.fact_registry.booking_url = {
            value: "manual",
            status: "answered",
            confidence: 0.88,
            verified: true,
            rationale: "Manual booking \u2014 no public scheduling URL (expected field enforcement)",
            updated_at: now
          };
          if (!updatedFactKeys.includes("booking_url")) updatedFactKeys.push("booking_url");
        }
      } else {
        const isPrimaryOffer = expectedField === "primary_offer";
        nextBlueprint.fact_registry[expectedField] = {
          value: cleanString4(answer),
          status: "answered",
          confidence: isPrimaryOffer ? 1 : 0.75,
          verified: true,
          rationale: isPrimaryOffer ? "User confirmed primary offer (expected field enforcement)" : "Captured from answer (expected field enforcement)",
          updated_at: now
        };
        if (!updatedFactKeys.includes(expectedField)) {
          updatedFactKeys.push(expectedField);
        }
      }
    }
  }
  const hasPricing = nextBlueprint.fact_registry?.pricing?.value;
  const answerText = cleanString4(answer).toLowerCase();
  if (expectedField === "pricing" && !hasMeaningfulValue2(hasPricing) && answerText.length > 3) {
    nextBlueprint.fact_registry.pricing = {
      value: answerText,
      status: "answered",
      confidence: 0.8,
      verified: true,
      rationale: "Fallback capture from user answer (pricing inference)",
      updated_at: now
    };
    if (!updatedFactKeys.includes("pricing")) {
      updatedFactKeys.push("pricing");
    }
  }
  const bookingMethod = nextBlueprint.fact_registry?.booking_method?.value;
  const currentBookingUrl = nextBlueprint.fact_registry?.booking_url;
  const bookingUrlAlreadyResolved = currentBookingUrl && currentBookingUrl.status === "answered";
  if (cleanString4(expectedField) !== "booking_url" && typeof bookingMethod === "string" && isManualBookingMethodValue(bookingMethod) && !bookingUrlAlreadyResolved) {
    nextBlueprint.fact_registry.booking_url = {
      value: "manual",
      status: "answered",
      confidence: 1,
      verified: true,
      rationale: "Resolved automatically: manual booking flow does not require URL.",
      updated_at: now
    };
    if (!updatedFactKeys.includes("booking_url")) {
      updatedFactKeys.push("booking_url");
    }
  }
  const bookingMethodValue = nextBlueprint.fact_registry?.booking_method?.value;
  const currentContactPath = nextBlueprint.fact_registry?.contact_path;
  const contactPathAlreadyResolved = currentContactPath && currentContactPath.status === "answered";
  if (typeof bookingMethodValue === "string" && bookingMethodValue.trim().length > 0 && !contactPathAlreadyResolved) {
    const normalizedMethod = bookingMethodValue.toLowerCase();
    nextBlueprint.fact_registry.contact_path = {
      value: normalizedMethod,
      status: "answered",
      confidence: 0.9,
      verified: true,
      rationale: "Derived from booking method",
      updated_at: now
    };
    if (!updatedFactKeys.includes("contact_path")) {
      updatedFactKeys.push("contact_path");
    }
  }
  applyNarrativeQualityPass(nextBlueprint, expectedField, answer);
  for (const patch of interpretation.draft_patches || []) {
    setByPath(nextBlueprint.business_draft, patch.path, deepClone(patch.value));
    patchedPaths.push(patch.path);
  }
  for (const refinement of interpretation.copy_refinements || []) {
    const existing = getByPath(nextBlueprint.business_draft, refinement.path);
    if (shouldApplyCopyRefinement(existing, refinement.value, refinement.confidence)) {
      setByPath(nextBlueprint.business_draft, refinement.path, deepClone(refinement.value));
      patchedPaths.push(refinement.path);
    }
  }
  nextBlueprint.evidence_log.push({
    timestamp: now,
    source: "user",
    answer_excerpt: truncate2(answer, 500),
    facts_updated: uniqueList2(updatedFactKeys),
    components_impacted: uniqueList2((interpretation.component_impacts || []).map((x) => x.component)),
    confidence: clampNumber(interpretation.confidence, 0, 1, 0),
    answer_summary: cleanString4(interpretation.answer_summary)
  });
  return {
    blueprint: nextBlueprint,
    audit: {
      timestamp: now,
      answered_decisions: normalizeStringArray(interpretation.answered_decisions),
      answer_summary: cleanString4(interpretation.answer_summary),
      interpretation_confidence: clampNumber(interpretation.confidence, 0, 1, 0),
      updated_fact_keys: uniqueList2(updatedFactKeys),
      patched_paths: uniqueList2(patchedPaths),
      component_impacts: deepClone(interpretation.component_impacts || []),
      unresolved_points: normalizeStringArray(interpretation.unresolved_points),
      notes: cleanString4(interpretation.notes),
      expected_primary_field: expectedField,
      primary_field_updated: !!(expectedField && updatedFactKeys.includes(expectedField)),
      secondary_updated_keys: uniqueList2(
        updatedFactKeys.filter((k) => cleanString4(k) && cleanString4(k) !== expectedField)
      )
    }
  };
}
__name(routeInterpretationToEvidence, "routeInterpretationToEvidence");
__name2(routeInterpretationToEvidence, "routeInterpretationToEvidence");
function recomputeBlueprint({ blueprint, state, schemaGuide, previousPlan, lastAudit }) {
  const nextBlueprint = deepClone(blueprint);
  assignDebugBlueprintId(nextBlueprint);
  nextBlueprint.question_history = Array.isArray(nextBlueprint.question_history) ? deepClone(nextBlueprint.question_history) : [];
  nextBlueprint.component_states = computeComponentStates({
    blueprint: nextBlueprint,
    schemaGuide,
    state
  });
  nextBlueprint.decision_states = computeDecisionStates({
    blueprint: nextBlueprint,
    schemaGuide
  });
  reevaluateStrategyToggles({
    blueprint: nextBlueprint,
    schemaGuide,
    state
  });
  syncBusinessDraftFromEvidence({
    blueprint: nextBlueprint,
    schemaGuide,
    state
  });
  nextBlueprint.section_status = computeSectionStatus({
    blueprint: nextBlueprint,
    schemaGuide
  });
  nextBlueprint.verification_queue = buildVerificationQueue({
    blueprint: nextBlueprint,
    schemaGuide,
    state
  });
  nextBlueprint.access_readiness = computeAccessReadiness(nextBlueprint, state);
  nextBlueprint.premium_readiness = computePremiumReadinessEngine(nextBlueprint);
  nextBlueprint.question_candidates = buildQuestionCandidates({
    blueprint: nextBlueprint,
    schemaGuide,
    previousPlan,
    lastAudit,
    state
  });
  console.log("\n\u{1F9ED} [PLANNER INPUT SNAPSHOT]");
  const fr = nextBlueprint?.fact_registry || {};
  Object.entries(fr).forEach(([k, v]) => {
    console.log(
      `${k}:`,
      v?.value,
      "| status:",
      v?.status,
      "| complete:",
      isFactComplete(v, k)
    );
  });
  const nextQuestionPlan = planNextQuestion(
    nextBlueprint.question_candidates,
    nextBlueprint.question_plan?.bundle_id,
    nextBlueprint.question_plan?.primary_field,
    nextBlueprint.fact_registry,
    nextBlueprint,
    state
  );
  nextBlueprint.question_plan = nextQuestionPlan ? deepClone(nextQuestionPlan) : null;
  if (nextBlueprint.question_plan) {
    const prevPf = cleanString4(previousPlan?.primary_field);
    const nextPf = cleanString4(nextBlueprint.question_plan.primary_field);
    const r = Array.isArray(nextBlueprint?.question_history) ? nextBlueprint.question_history.length : 0;
    const sticky = r > 0 && !!prevPf && !isFieldSatisfied(prevPf, nextBlueprint.fact_registry);
    if (sticky && nextPf === prevPf) {
      nextBlueprint.question_plan.selection_reason = "sticky_primary_unsatisfied";
    } else {
      nextBlueprint.question_plan.selection_reason = "dynamic_priority";
    }
    nextBlueprint.question_plan.priority_score = computeDynamicPriority(
      nextPf,
      nextBlueprint,
      state,
      r
    );
    const bm = cleanString4(nextBlueprint.strategy?.business_context?.business_model);
    const sig = Array.isArray(nextBlueprint.question_plan.preflight_signals_used) ? [...nextBlueprint.question_plan.preflight_signals_used] : [];
    if (bm && !sig.includes(bm)) sig.unshift(bm);
    if (!sig.length) sig.push("unknown");
    nextBlueprint.question_plan.preflight_signals_used = sig;
  }
  return { blueprint: nextBlueprint };
}
__name(recomputeBlueprint, "recomputeBlueprint");
__name2(recomputeBlueprint, "recomputeBlueprint");
function computeComponentStates({ blueprint, schemaGuide, state }) {
  const out = {};
  const factRegistry = safeObject(blueprint.fact_registry);
  const businessDraft = safeObject(blueprint.business_draft);
  for (const [component, guide] of Object.entries(schemaGuide)) {
    if (component.startsWith("_")) continue;
    const evidenceKeys = cleanList3(guide.evidence_keys);
    const presentEvidence = evidenceKeys.filter(
      (key) => isEvidenceKeyPresentForComponentStates(key, factRegistry)
    );
    const missingEvidence = evidenceKeys.filter(
      (key) => !isEvidenceKeyPresentForComponentStates(key, factRegistry)
    );
    const confidenceBase = evidenceKeys.length ? presentEvidence.length / evidenceKeys.length : 0.5;
    const enabled = evaluateComponentEnabled({
      component,
      guide,
      blueprint,
      state,
      confidenceBase
    });
    const draftReady = evaluateComponentDraftReady(component, businessDraft, presentEvidence, guide);
    const premiumReady = evaluateComponentPremiumReady(component, businessDraft, factRegistry, guide);
    out[component] = {
      enabled,
      confidence: Number(confidenceBase.toFixed(2)),
      evidence_keys: evidenceKeys,
      present_evidence: presentEvidence,
      missing_evidence: missingEvidence,
      draft_ready: draftReady,
      premium_ready: premiumReady,
      why_enabled: enabled ? buildComponentEnableReasons(component, guide, blueprint, factRegistry) : [],
      why_disabled: enabled ? [] : buildComponentDisableReasons(component, guide, blueprint, factRegistry),
      planner_priority: computeComponentPlannerPriority(component, guide),
      ai_priority: cleanString4(guide.ai_priority),
      purpose: cleanString4(guide.purpose)
    };
  }
  return out;
}
__name(computeComponentStates, "computeComponentStates");
__name2(computeComponentStates, "computeComponentStates");
function evaluateComponentEnabled({ component, guide, blueprint, state, confidenceBase }) {
  if (guide.required) return true;
  const toggles = safeObject(
    blueprint?.strategy?.schema_toggles || state?.provenance?.strategy_contract?.schema_toggles
  );
  const toggleKey = cleanString4(guide.toggle_key);
  if (toggleKey && typeof toggles[toggleKey] === "boolean") {
    if (toggles[toggleKey] === true) return true;
  }
  const fact = blueprint.fact_registry;
  switch (component) {
    case "processSteps":
      return looksLikeProcessFact(fact?.process_summary?.value);
    case "gallery":
      return confidenceBase >= 0.3 || hasMeaningfulValue2(fact?.gallery_visual_direction?.value) || hasMeaningfulValue2(fact?.image_themes?.value);
    case "faqs":
      return confidenceBase >= 0.3 || Array.isArray(fact?.faq_angles?.value) && fact?.faq_angles?.value.length > 0;
    case "investment":
      return isStandardizedPricing(fact?.pricing?.value);
    case "events":
      return Array.isArray(fact?.events?.value) && fact?.events?.value.length >= 3;
    case "comparison":
      return hasMeaningfulValue2(fact?.comparison?.value);
    case "service_area":
      return confidenceBase >= 0.2 || hasMeaningfulValue2(fact?.service_area_main?.value);
    default:
      return !!toggles[toggleKey];
  }
}
__name(evaluateComponentEnabled, "evaluateComponentEnabled");
__name2(evaluateComponentEnabled, "evaluateComponentEnabled");
function buildComponentEnableReasons(component, guide, blueprint, factRegistry) {
  const reasons = [];
  if (guide.required) reasons.push("Required by schema.");
  if (guide.toggle_key && blueprint?.strategy?.schema_toggles?.[guide.toggle_key] === true) {
    reasons.push(`Enabled by ${guide.toggle_key}.`);
  }
  if (component === "processSteps" && looksLikeProcessFact(factRegistry?.process_summary?.value)) {
    reasons.push("Client described a real service workflow.");
  }
  if (component === "gallery" && (hasVisualInferenceSignals(factRegistry) || isFactComplete(factRegistry?.gallery_visual_direction, "gallery_visual_direction"))) {
    reasons.push("Visual direction evidence exists.");
  }
  if (component === "investment" && isStandardizedPricing(factRegistry?.pricing?.value)) {
    reasons.push("Pricing appears standardized enough for an investment section.");
  }
  return reasons;
}
__name(buildComponentEnableReasons, "buildComponentEnableReasons");
__name2(buildComponentEnableReasons, "buildComponentEnableReasons");
function buildComponentDisableReasons(component, guide, blueprint, factRegistry) {
  const reasons = [];
  if (guide.toggle_key && blueprint?.strategy?.schema_toggles?.[guide.toggle_key] === false) {
    reasons.push(`Currently disabled by ${guide.toggle_key}.`);
  }
  if (component === "processSteps" && !looksLikeProcessFact(factRegistry?.process_summary?.value)) {
    reasons.push("No confirmed workflow evidence yet.");
  }
  if (component === "gallery" && !hasVisualInferenceSignals(factRegistry) && !isFactComplete(factRegistry?.gallery_visual_direction, "gallery_visual_direction")) {
    reasons.push("No confirmed gallery visual strategy yet.");
  }
  return reasons;
}
__name(buildComponentDisableReasons, "buildComponentDisableReasons");
__name2(buildComponentDisableReasons, "buildComponentDisableReasons");
function computeComponentPlannerPriority(component, guide) {
  const base = {
    critical: 220,
    recommended: 150,
    optional: 90
  }[cleanString4(guide.ai_priority)] || 100;
  const componentBoost = {
    hero: 60,
    features: 50,
    processSteps: 42,
    gallery: 38,
    faqs: 32,
    investment: 28,
    service_area: 30,
    contact: 20,
    testimonials: 24,
    about: 18,
    events: 16,
    comparison: 16
  }[component] || 0;
  return base + componentBoost;
}
__name(computeComponentPlannerPriority, "computeComponentPlannerPriority");
__name2(computeComponentPlannerPriority, "computeComponentPlannerPriority");
function evaluateComponentDraftReady(component, businessDraft) {
  if (component === "gallery") {
    return hasMeaningfulValue2(getByPath(businessDraft, "gallery.image_source.image_search_query"));
  }
  if (component === "hero") {
    return hasMeaningfulValue2(getByPath(businessDraft, "hero.headline")) && hasMeaningfulValue2(getByPath(businessDraft, "hero.image.image_search_query"));
  }
  if (component === "contact") {
    return hasMeaningfulValue2(getByPath(businessDraft, "contact.headline")) && hasMeaningfulValue2(getByPath(businessDraft, "contact.button_text"));
  }
  return hasMeaningfulValue2(getByPath(businessDraft, component));
}
__name(evaluateComponentDraftReady, "evaluateComponentDraftReady");
__name2(evaluateComponentDraftReady, "evaluateComponentDraftReady");
function evaluateComponentPremiumReady(component, businessDraft, factRegistry) {
  switch (component) {
    case "hero":
      return hasMeaningfulValue2(getByPath(businessDraft, "hero.headline")) && hasMeaningfulValue2(getByPath(businessDraft, "hero.subtext")) && hasMeaningfulValue2(getByPath(businessDraft, "hero.image.alt")) && hasMeaningfulValue2(getByPath(businessDraft, "hero.image.image_search_query"));
    case "gallery":
      return hasMeaningfulValue2(getByPath(businessDraft, "gallery.image_source.image_search_query")) && hasMeaningfulValue2(
        firstNonEmpty2([
          getByPath(businessDraft, "gallery.computed_layout"),
          getByPath(businessDraft, "gallery.layout")
        ])
      ) && typeof getByPath(businessDraft, "gallery.computed_count") === "number";
    case "processSteps":
      return Array.isArray(getByPath(businessDraft, "processSteps")) && getByPath(businessDraft, "processSteps").length >= 3;
    case "features":
      return Array.isArray(getByPath(businessDraft, "features")) && getByPath(businessDraft, "features").length >= 2;
    default:
      return false;
  }
}
__name(evaluateComponentPremiumReady, "evaluateComponentPremiumReady");
__name2(evaluateComponentPremiumReady, "evaluateComponentPremiumReady");
function computeDecisionStates({ blueprint, schemaGuide }) {
  const out = {};
  const map = buildDecisionMap(schemaGuide);
  const componentStates = safeObject(blueprint.component_states);
  const factRegistry = safeObject(blueprint.fact_registry);
  for (const [decision, config] of Object.entries(map)) {
    const impactedComponents = config.components.filter((component) => componentStates[component]);
    const confidence = impactedComponents.length ? impactedComponents.reduce((sum, component) => sum + Number(componentStates[component].confidence || 0), 0) / impactedComponents.length : 0;
    const missingEvidence = uniqueList2(
      impactedComponents.flatMap((component) => componentStates[component].missing_evidence || [])
    );
    out[decision] = {
      confidence: Number(confidence.toFixed(2)),
      impacted_components: impactedComponents,
      missing_evidence: missingEvidence,
      next_best_question_reason: cleanString4(config.reason),
      priority: config.priority
    };
  }
  if (looksLikeProcessFact(factRegistry?.process_summary?.value)) {
    out.process = out.process || {};
    out.process.confidence = Math.max(Number(out.process.confidence || 0), 0.72);
  }
  if (isFactComplete(factRegistry?.gallery_visual_direction, "gallery_visual_direction") || hasVisualInferenceSignals(factRegistry)) {
    out.gallery_strategy = out.gallery_strategy || {};
    out.gallery_strategy.confidence = Math.max(Number(out.gallery_strategy.confidence || 0), 0.68);
  }
  if (isStandardizedPricing(factRegistry?.pricing?.value)) {
    out.pricing_model = out.pricing_model || {};
    out.pricing_model.confidence = Math.max(Number(out.pricing_model.confidence || 0), 0.7);
  }
  return out;
}
__name(computeDecisionStates, "computeDecisionStates");
__name2(computeDecisionStates, "computeDecisionStates");
function buildDecisionMap(schemaGuide) {
  return {
    positioning: {
      components: ["hero", "features"],
      priority: 220,
      reason: "Clarify who the offer is for, what it is, and what makes it stand apart."
    },
    conversion: {
      components: ["hero", "contact"],
      priority: 230,
      reason: "Clarify how visitors move from interest to action."
    },
    proof: {
      components: ["trustbar", "testimonials", "about"],
      priority: 190,
      reason: "Clarify why this business should be trusted quickly."
    },
    process: {
      components: ["processSteps"],
      priority: 175,
      reason: "Capture the workflow to reduce friction and strengthen credibility."
    },
    service_area: {
      components: ["service_area"],
      priority: 170,
      reason: "Clarify the main market and nearby locations served."
    },
    gallery_strategy: {
      components: ["gallery", "hero"],
      priority: 165,
      reason: "Define the visual strategy, search query, layout, and image count."
    },
    pricing_model: {
      components: ["investment", "faqs", "contact"],
      priority: 155,
      reason: "Clarify pricing expectations and whether structured investment belongs on the site."
    },
    objection_handling: {
      components: ["faqs"],
      priority: 145,
      reason: "Capture the objections and questions visitors need answered."
    },
    story: {
      components: ["about"],
      priority: 135,
      reason: "Clarify the founder story, standards, and business philosophy."
    },
    events_strategy: {
      components: ["events"],
      priority: 110,
      reason: "Determine whether time-based offerings belong on the site."
    },
    comparison_strategy: {
      components: ["comparison"],
      priority: 105,
      reason: "Determine whether comparison helps buyers decide."
    },
    contact_details: {
      components: ["contact", "brand"],
      priority: 60,
      reason: "Verify public contact facts needed for publish-readiness."
    }
  };
}
__name(buildDecisionMap, "buildDecisionMap");
__name2(buildDecisionMap, "buildDecisionMap");
function reevaluateStrategyToggles({ blueprint, state }) {
  const toggles = safeObject(blueprint.strategy?.schema_toggles);
  const fact = safeObject(blueprint.fact_registry);
  const componentStates = safeObject(blueprint.component_states);
  toggles.show_process = componentStates.processSteps?.enabled === true;
  toggles.show_gallery = componentStates.gallery?.enabled === true;
  toggles.show_faqs = componentStates.faqs?.enabled === true || Array.isArray(fact?.faq_angles?.value) && fact?.faq_angles?.value.length > 0;
  toggles.show_investment = componentStates.investment?.enabled === true;
  toggles.show_events = componentStates.events?.enabled === true;
  toggles.show_comparison = componentStates.comparison?.enabled === true;
  toggles.show_service_area = componentStates.service_area?.enabled === true;
  toggles.show_testimonials = componentStates.testimonials?.enabled === true || componentStates.trustbar?.enabled === true;
  blueprint.strategy.schema_toggles = toggles;
  safeAssignPathIfExists(blueprint.business_draft, "strategy.show_process", toggles.show_process);
  safeAssignPathIfExists(blueprint.business_draft, "strategy.show_gallery", toggles.show_gallery);
  safeAssignPathIfExists(blueprint.business_draft, "strategy.show_faqs", toggles.show_faqs);
  safeAssignPathIfExists(blueprint.business_draft, "strategy.show_investment", toggles.show_investment);
  safeAssignPathIfExists(blueprint.business_draft, "strategy.show_events", toggles.show_events);
  safeAssignPathIfExists(blueprint.business_draft, "strategy.show_comparison", toggles.show_comparison);
  safeAssignPathIfExists(blueprint.business_draft, "strategy.show_service_area", toggles.show_service_area);
  safeAssignPathIfExists(blueprint.business_draft, "strategy.show_testimonials", toggles.show_testimonials);
}
__name(reevaluateStrategyToggles, "reevaluateStrategyToggles");
__name2(reevaluateStrategyToggles, "reevaluateStrategyToggles");
function syncBusinessDraftFromEvidence({ blueprint, state }) {
  const draft = blueprint.business_draft;
  syncHeroDraftFromEvidence(draft, blueprint.fact_registry, state);
  syncAboutDraftFromEvidence(draft, blueprint.fact_registry, state);
  syncProofDraftFromEvidence(draft, blueprint.fact_registry, state);
  syncServiceAreaDraftFromEvidence(draft, blueprint.fact_registry, state);
  syncProcessDraftFromEvidence(draft, blueprint.fact_registry, state);
  syncGalleryDraftFromEvidence(draft, blueprint.fact_registry, state);
  syncFaqDraftFromEvidence(draft, blueprint.fact_registry, state);
  syncInvestmentDraftFromEvidence(draft, blueprint.fact_registry, state);
  syncContactDraftFromEvidence(draft, blueprint.fact_registry, state);
  syncFeaturesDraftFromEvidence(draft, blueprint.fact_registry, state);
  const fact = /* @__PURE__ */ __name2((key) => blueprint.fact_registry?.[key]?.value, "fact");
  safeAssignPathIfExists(draft, "brand.name", fact("business_name"));
  safeAssignPathIfExists(draft, "brand.email", fact("email"));
  safeAssignPathIfExists(draft, "brand.phone", fact("phone"));
  safeAssignPathIfExists(draft, "brand.office_address", firstNonEmpty2([fact("address"), fact("office_address")]));
  safeAssignPathIfExists(draft, "brand.tagline", firstNonEmpty2([fact("tagline"), buildTaglineFromEvidence(blueprint.fact_registry)]));
  safeAssignPathIfExists(draft, "intelligence.industry", fact("industry"));
  safeAssignPathIfExists(draft, "intelligence.target_persona", fact("target_persona"));
  safeAssignPathIfExists(draft, "intelligence.tone_of_voice", fact("tone_of_voice"));
  safeAssignPathIfExists(draft, "settings.vibe", firstNonEmpty2([fact("vibe"), inferVibe(state)]));
  safeAssignPathIfExists(draft, "settings.cta_text", firstNonEmpty2([fact("cta_text"), "Get Started"]));
  safeAssignPathIfExists(draft, "settings.cta_link", firstNonEmpty2([bookingUrlValueForDraftLink(fact("booking_url")), fact("cta_link"), "#contact"]));
  safeAssignPathIfExists(
    draft,
    "settings.cta_type",
    hasMeaningfulValue2(bookingUrlValueForDraftLink(fact("booking_url"))) ? "external" : "anchor"
  );
  syncMenuFromToggles(draft, blueprint.strategy?.schema_toggles || {});
}
__name(syncBusinessDraftFromEvidence, "syncBusinessDraftFromEvidence");
__name2(syncBusinessDraftFromEvidence, "syncBusinessDraftFromEvidence");
function syncHeroDraftFromEvidence(draft, factRegistry, state) {
  const fact = /* @__PURE__ */ __name2((key) => factRegistry?.[key]?.value, "fact");
  const businessName = firstNonEmpty2([fact("business_name"), state.businessName, "This business"]);
  const offer = cleanString4(fact("primary_offer"));
  const persona = firstNonEmpty2([
    cleanString4(fact("target_persona")),
    cleanString4(state?.preflight_intelligence?.target_persona_hint)
  ]);
  const differentiation = cleanString4(fact("differentiation"));
  const bookingMethod = cleanString4(fact("booking_method"));
  const headline = buildHeroHeadlineFromEvidence({ businessName, offer, differentiation });
  const subtext = buildHeroSubtextFromEvidence({ offer, persona, differentiation, bookingMethod });
  safeAssignPathIfExists(draft, "hero.headline", headline);
  safeAssignPathIfExists(draft, "hero.subtext", subtext);
  const heroAlt = firstNonEmpty2([
    fact("hero_image_alt"),
    `${businessName} delivering ${offer || "premium service"}`
  ]);
  safeAssignPathIfExists(draft, "hero.image.alt", heroAlt);
  const heroQuery = firstNonEmpty2([
    fact("hero_image_query"),
    buildHeroImageQuery2({
      industry: fact("industry"),
      offer,
      themes: fact("image_themes"),
      differentiation,
      recommended_focus: fact("recommended_focus")
    })
  ]);
  safeAssignPathIfExists(draft, "hero.image.image_search_query", heroQuery);
}
__name(syncHeroDraftFromEvidence, "syncHeroDraftFromEvidence");
__name2(syncHeroDraftFromEvidence, "syncHeroDraftFromEvidence");
function syncAboutDraftFromEvidence(draft, factRegistry) {
  const fact = /* @__PURE__ */ __name2((key) => factRegistry?.[key]?.value, "fact");
  safeAssignPathIfExists(draft, "about.story_text", firstNonEmpty2([fact("founder_story"), fact("business_understanding")]));
  safeAssignPathIfExists(draft, "about.founder_note", firstNonEmpty2([fact("founder_story"), fact("differentiation")]));
  safeAssignPathIfExists(draft, "about.years_experience", stringifyFactValue(fact("years_experience")));
}
__name(syncAboutDraftFromEvidence, "syncAboutDraftFromEvidence");
__name2(syncAboutDraftFromEvidence, "syncAboutDraftFromEvidence");
function syncProofDraftFromEvidence(draft, factRegistry) {
  const fact = /* @__PURE__ */ __name2((key) => factRegistry?.[key]?.value, "fact");
  const trustSignal = firstNonEmpty2([fact("trust_signal"), "Trusted by clients who value quality"]);
  const years = stringifyFactValue(fact("years_experience"));
  if (hasPath(draft, "trustbar.enabled")) safeAssignPathIfExists(draft, "trustbar.enabled", true);
  if (hasPath(draft, "trustbar.items")) {
    const items = [
      { label: trustSignal, icon: "shield" },
      years ? { label: `${years} of experience`, icon: "award" } : null
    ].filter(Boolean);
    if (items.length >= 1) {
      safeAssignPathIfExists(draft, "trustbar.items", items);
    }
  }
  if (Array.isArray(getByPath(draft, "testimonials")) && Array.isArray(fact("review_quotes")) && fact("review_quotes").length) {
    safeAssignPathIfExists(draft, "testimonials", fact("review_quotes"));
  }
}
__name(syncProofDraftFromEvidence, "syncProofDraftFromEvidence");
__name2(syncProofDraftFromEvidence, "syncProofDraftFromEvidence");
function syncServiceAreaDraftFromEvidence(draft, factRegistry) {
  const fact = /* @__PURE__ */ __name2((key) => factRegistry?.[key]?.value, "fact");
  const mainCity = firstNonEmpty2([fact("service_area_main"), firstArrayItem(fact("service_area_list"))]);
  const surrounding = ensureArrayStrings(firstNonEmptyArray([fact("surrounding_cities"), fact("service_area_list")])).filter((item) => item !== mainCity);
  safeAssignPathIfExists(draft, "service_area.main_city", mainCity);
  safeAssignPathIfExists(draft, "service_area.surrounding_cities", surrounding);
  safeAssignPathIfExists(draft, "service_area.travel_note", buildServiceAreaTravelNote(mainCity, surrounding));
  safeAssignPathIfExists(draft, "service_area.map_search_query", mainCity ? `${cleanString4(fact("primary_offer") || fact("industry") || "service")} near ${mainCity}` : "");
}
__name(syncServiceAreaDraftFromEvidence, "syncServiceAreaDraftFromEvidence");
__name2(syncServiceAreaDraftFromEvidence, "syncServiceAreaDraftFromEvidence");
function syncProcessDraftFromEvidence(draft, factRegistry) {
  const fact = /* @__PURE__ */ __name2((key) => factRegistry?.[key]?.value, "fact");
  const processSummary = cleanString4(fact("process_summary"));
  if (!looksLikeProcessFact(processSummary)) return;
  const steps = buildProcessStepsFromSummary(processSummary);
  if (steps.length >= 3) {
    safeAssignPathIfExists(draft, "processSteps", steps);
  }
}
__name(syncProcessDraftFromEvidence, "syncProcessDraftFromEvidence");
__name2(syncProcessDraftFromEvidence, "syncProcessDraftFromEvidence");
function syncGalleryDraftFromEvidence(draft, factRegistry, state) {
  const fact = /* @__PURE__ */ __name2((key) => factRegistry?.[key]?.value, "fact");
  const industry = cleanString4(fact("industry"));
  const offer = cleanString4(fact("primary_offer"));
  const differentiation = cleanString4(fact("differentiation"));
  const vibe = cleanString4(fact("vibe"));
  const visualDirection = cleanString4(fact("gallery_visual_direction"));
  const themes = ensureArrayStrings(fact("image_themes"));
  const galleryQuery = firstNonEmpty2([
    visualDirection,
    buildGalleryImageQuery({
      industry,
      offer,
      differentiation,
      themes,
      recommended_focus: fact("recommended_focus")
    })
  ]);
  const computedLayout = inferGalleryLayout({ vibe, offer, differentiation });
  const computedCount = inferGalleryCount({ offer, differentiation, visualDirection });
  safeAssignPathIfExists(draft, "gallery.enabled", true);
  safeAssignPathIfExists(draft, "gallery.title", firstNonEmpty2([
    `${cleanString4(industry) || "Gallery"} Highlights`,
    "Gallery Highlights"
  ]));
  safeAssignPathIfExists(draft, "gallery.image_source.image_search_query", galleryQuery);
  safeAssignPathIfExists(draft, "gallery.layout", computedLayout);
  draft.gallery = isObject3(draft.gallery) ? draft.gallery : {};
  draft.gallery.computed_layout = computedLayout;
  draft.gallery.computed_count = computedCount;
}
__name(syncGalleryDraftFromEvidence, "syncGalleryDraftFromEvidence");
__name2(syncGalleryDraftFromEvidence, "syncGalleryDraftFromEvidence");
function syncFaqDraftFromEvidence(draft, factRegistry) {
  const fact = /* @__PURE__ */ __name2((key) => factRegistry?.[key]?.value, "fact");
  const faqAngles = ensureArrayStrings(fact("faq_angles"));
  if (Array.isArray(getByPath(draft, "faqs")) && faqAngles.length) {
    safeAssignPathIfExists(
      draft,
      "faqs",
      faqAngles.slice(0, 6).map((question) => ({
        question,
        answer: ""
      }))
    );
  }
}
__name(syncFaqDraftFromEvidence, "syncFaqDraftFromEvidence");
__name2(syncFaqDraftFromEvidence, "syncFaqDraftFromEvidence");
function syncInvestmentDraftFromEvidence(draft, factRegistry) {
  const fact = /* @__PURE__ */ __name2((key) => factRegistry?.[key]?.value, "fact");
  const pricing = cleanString4(fact("pricing"));
  if (!Array.isArray(getByPath(draft, "investment"))) return;
  if (!isStandardizedPricing(pricing)) return;
  safeAssignPathIfExists(draft, "investment", [
    {
      tier_name: "Core Service",
      price: pricing,
      popular: true,
      features: ["Pricing guided by the current scope"]
    }
  ]);
}
__name(syncInvestmentDraftFromEvidence, "syncInvestmentDraftFromEvidence");
__name2(syncInvestmentDraftFromEvidence, "syncInvestmentDraftFromEvidence");
function syncContactDraftFromEvidence(draft, factRegistry, state) {
  const fact = /* @__PURE__ */ __name2((key) => factRegistry?.[key]?.value, "fact");
  const businessName = firstNonEmpty2([fact("business_name"), state.businessName, "our team"]);
  safeAssignPathIfExists(draft, "contact.title", firstNonEmpty2([
    fact("cta_text"),
    "Request a Quote"
  ]));
  safeAssignPathIfExists(
    draft,
    "contact.text",
    buildContactSubheadline({
      bookingMethod: fact("booking_method"),
      pricing: fact("pricing"),
      contactPath: fact("contact_path")
    })
  );
  safeAssignPathIfExists(draft, "contact.cta_text", firstNonEmpty2([fact("cta_text"), "Get in Touch"]));
  safeAssignPathIfExists(draft, "contact.cta_link", firstNonEmpty2([bookingUrlValueForDraftLink(fact("booking_url")), fact("cta_link"), "#contact"]));
}
__name(syncContactDraftFromEvidence, "syncContactDraftFromEvidence");
__name2(syncContactDraftFromEvidence, "syncContactDraftFromEvidence");
function syncFeaturesDraftFromEvidence(draft, factRegistry) {
  const fact = /* @__PURE__ */ __name2((key) => factRegistry?.[key]?.value, "fact");
  const serviceList = ensureArrayStrings(fact("service_list"));
  const offer = cleanString4(fact("primary_offer"));
  const diff = cleanString4(fact("differentiation"));
  if (!Array.isArray(getByPath(draft, "features"))) return;
  if (getByPath(draft, "features").length > 0) return;
  const baseFeatures = serviceList.length ? serviceList.slice(0, 4).map((item, index) => ({
    title: titleCase(item),
    description: offer || diff || item,
    icon_slug: safeFeatureIcon(ALLOWED_ICON_TOKENS2[index] || "check")
  })) : [
    {
      title: "What We Deliver",
      description: firstNonEmpty2([offer, diff, "Premium results tailored to the client."]),
      icon_slug: safeFeatureIcon("check")
    }
  ];
  safeAssignPathIfExists(draft, "features", baseFeatures);
}
__name(syncFeaturesDraftFromEvidence, "syncFeaturesDraftFromEvidence");
__name2(syncFeaturesDraftFromEvidence, "syncFeaturesDraftFromEvidence");
function syncMenuFromToggles(draft, toggles) {
  if (!Array.isArray(getByPath(draft, "settings.menu"))) return;
  const menu = [{ label: "Home", path: "#home" }];
  if (toggles.show_about) menu.push({ label: "About", path: "#about" });
  menu.push({ label: "Features", path: "#features" });
  if (toggles.show_events) menu.push({ label: "Events", path: "#events" });
  if (toggles.show_process) menu.push({ label: "Process", path: "#process" });
  if (toggles.show_testimonials) menu.push({ label: "Testimonials", path: "#testimonials" });
  if (toggles.show_comparison) menu.push({ label: "Comparison", path: "#comparison" });
  if (toggles.show_gallery) menu.push({ label: "Gallery", path: "#gallery" });
  if (toggles.show_investment) menu.push({ label: "Investment", path: "#investment" });
  if (toggles.show_faqs) menu.push({ label: "FAQs", path: "#faqs" });
  if (toggles.show_service_area) menu.push({ label: "Service Area", path: "#service-area" });
  menu.push({ label: "Contact", path: "#contact" });
  const allowed = /* @__PURE__ */ new Set([
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
  ]);
  const safeMenu = menu.filter((item) => allowed.has(item.path));
  safeAssignPathIfExists(draft, "settings.menu", safeMenu);
}
__name(syncMenuFromToggles, "syncMenuFromToggles");
__name2(syncMenuFromToggles, "syncMenuFromToggles");
function computeSectionStatus({ blueprint, schemaGuide }) {
  const out = {};
  const draft = safeObject(blueprint.business_draft);
  const components = safeObject(blueprint.component_states);
  for (const [component, guide] of Object.entries(schemaGuide)) {
    if (component.startsWith("_")) continue;
    const state = components[component] || {};
    const sectionValue = getByPath(draft, component);
    const hasDraft = hasMeaningfulValue2(sectionValue);
    const score = Number(
      (Number(state.confidence || 0) * 0.5 + (state.draft_ready ? 0.25 : 0) + (state.premium_ready ? 0.25 : 0)).toFixed(2)
    );
    out[component] = {
      enabled: !!state.enabled,
      required: !!guide.required,
      score,
      draft_ready: !!state.draft_ready,
      premium_ready: !!state.premium_ready,
      status: !state.enabled ? "disabled" : score >= 0.9 ? "strong" : score >= 0.55 ? "partial" : "weak",
      has_draft: hasDraft
    };
  }
  return out;
}
__name(computeSectionStatus, "computeSectionStatus");
__name2(computeSectionStatus, "computeSectionStatus");
function buildVerificationQueue({ blueprint, state }) {
  const queue = [];
  const factRegistry = safeObject(blueprint.fact_registry);
  const decisionStates = safeObject(blueprint.decision_states);
  const strategyContract = safeObject(state?.provenance?.strategy_contract);
  const mustVerifyNow = cleanList3(strategyContract?.content_requirements?.must_verify_now);
  const publishRequired = cleanList3(strategyContract?.content_requirements?.publish_required_fields);
  for (const [key, fact] of Object.entries(factRegistry)) {
    const needsEvidence = evidenceKeyNeedsEvidence(key, factRegistry);
    const partial = cleanString4(fact?.status) === "partial";
    const requiresClient = !!fact?.requires_client_verification;
    const relatedSections = cleanList3(fact?.related_sections);
    const bundleId = inferDecisionForFact(key);
    const priorityBase = Number(decisionStates?.[bundleId]?.priority || 100);
    const verifyTerms = mustVerifyNow.concat(publishRequired).map((x) => x.toLowerCase());
    const keyWords = key.toLowerCase().replace(/_/g, " ");
    const shouldVerifyByContract = verifyTerms.some((term) => keyWords.includes(term) || term.includes(keyWords));
    if (cleanString4(key) === "booking_url" && isBookingUrlResolved(fact) && !requiresClient && !shouldVerifyByContract) {
      continue;
    }
    if (!needsEvidence && !partial && !requiresClient && !shouldVerifyByContract) continue;
    queue.push({
      field_key: key,
      bundle_id: bundleId,
      priority: priorityBase + (needsEvidence ? 70 : 0) + (partial ? 35 : 0) + (requiresClient ? 25 : 0) + (shouldVerifyByContract ? 20 : 0),
      missing: needsEvidence,
      partial,
      requires_client_verification: requiresClient,
      related_sections: relatedSections,
      reason: inferVerificationReasonForFact(key)
    });
  }
  return queue.sort((a, b) => b.priority - a.priority);
}
__name(buildVerificationQueue, "buildVerificationQueue");
__name2(buildVerificationQueue, "buildVerificationQueue");
function mapPreflightBusinessModelToAccessModel(raw) {
  const m = cleanString4(raw).toLowerCase().replace(/\s+/g, "_");
  if (!m) return null;
  if (m === "storefront" || m.includes("storefront")) return "local_physical";
  if (m === "service_area" || m === "service-area") return "local_service_area";
  if (m === "online") return "virtual_remote";
  if (m === "hybrid") return "hybrid";
  if (m === "destination") return "hybrid";
  return null;
}
__name(mapPreflightBusinessModelToAccessModel, "mapPreflightBusinessModelToAccessModel");
__name2(mapPreflightBusinessModelToAccessModel, "mapPreflightBusinessModelToAccessModel");
function inferAccessModel(blueprint, state) {
  const fr = safeObject(blueprint?.fact_registry);
  const strategy = safeObject(blueprint?.strategy);
  const bc = safeObject(strategy.business_context);
  const provenanceBc = safeObject(state?.provenance?.strategy_contract?.business_context);
  const preflightBm = firstNonEmpty2([
    cleanString4(bc.business_model),
    cleanString4(provenanceBc.business_model)
  ]);
  const fromPreflight = mapPreflightBusinessModelToAccessModel(preflightBm);
  if (fromPreflight) return fromPreflight;
  const cat = cleanString4(bc.category).toLowerCase();
  const arch = cleanString4(bc.strategic_archetype).toLowerCase();
  const pi = safeObject(state?.preflight_intelligence);
  const bm = cleanString4(fr.booking_method?.value).toLowerCase().replace(/\s+/g, "_");
  const blob = [
    cat,
    arch,
    cleanString4(fr.primary_offer?.value),
    cleanString4(fr.business_understanding?.value),
    cleanString4(pi?.positioning),
    cleanString4(pi?.opportunity),
    cleanString4(bc.business_description),
    cleanString4(bc.summary)
  ].join(" ").toLowerCase();
  const hasAddr = isFactComplete(fr.address, "address");
  const hasMainGeo = isFactComplete(fr.service_area_main, "service_area_main");
  if (bm.includes("virtual") || /\bremote\b|\bvirtual\b/.test(arch)) {
    return "virtual_remote";
  }
  if (/\b(coach|consulting|agency|freelance|online)\b/.test(cat) || /\b(coach|consultant|advisor)\b/.test(blob)) {
    return "virtual_remote";
  }
  if (/\b(mobile|field)\b/.test(arch) || blob.includes("we come to you") || blob.includes("come to your") || /\bserving\b/.test(blob) || blob.includes("mobile") && blob.includes("service")) {
    return "local_service_area";
  }
  if (/\b(gallery|salon|retail|restaurant|storefront|framing)\b/.test(cat) || blob.includes("visit us") || blob.includes("our location") || blob.includes("walk-in")) {
    return "local_physical";
  }
  if ((blob.includes("studio") || blob.includes("gallery")) && (blob.includes("online") || blob.includes("book online") || blob.includes("schedule online"))) {
    return "hybrid";
  }
  if (hasAddr && hasMainGeo) return "hybrid";
  if (hasAddr) return "local_physical";
  if (hasMainGeo) return "local_service_area";
  return "hybrid";
}
__name(inferAccessModel, "inferAccessModel");
__name2(inferAccessModel, "inferAccessModel");
function requiresPublishedPhoneForExecution(bmRaw) {
  const m = cleanString4(bmRaw).toLowerCase().replace(/\s+/g, "_");
  if (!m || m === "manual") return false;
  return isManualBookingMethodValue(bmRaw);
}
__name(requiresPublishedPhoneForExecution, "requiresPublishedPhoneForExecution");
__name2(requiresPublishedPhoneForExecution, "requiresPublishedPhoneForExecution");
function evaluateExecutionPathForAccess(fr) {
  const bm = fr?.booking_method?.value;
  const hasPhone = isFactComplete(fr.phone, "phone");
  const hasEmail = isFactComplete(fr.email, "email");
  const contactPathOk = isFieldSatisfied("contact_path", fr);
  const bookingUrlOk = isFieldSatisfied("booking_url", fr);
  const m = cleanString4(bm).toLowerCase().replace(/\s+/g, "_");
  if (!hasMeaningfulValue2(bm)) {
    return { ok: false, missing_focus_id: "action_path" };
  }
  if (requiresPublishedPhoneForExecution(bm)) {
    return hasPhone ? { ok: true, missing_focus_id: null } : { ok: false, missing_focus_id: "phone_for_call" };
  }
  if (m.includes("book_online") || m.includes("online_booking") || m.includes("schedule") && (m.includes("online") || m.includes("link"))) {
    const v = fr.booking_url?.value;
    const real = typeof v === "string" && hasMeaningfulValue2(v) && !isBookingUrlNoLinkSentinel(v) && isPlausibleBookingUrlString(v);
    return real ? { ok: true, missing_focus_id: null } : { ok: false, missing_focus_id: "booking_url_live" };
  }
  const hasReach = hasPhone || hasEmail;
  const ok = hasReach || contactPathOk || bookingUrlOk;
  return {
    ok,
    missing_focus_id: ok ? null : "action_path"
  };
}
__name(evaluateExecutionPathForAccess, "evaluateExecutionPathForAccess");
__name2(evaluateExecutionPathForAccess, "evaluateExecutionPathForAccess");
function evaluateAccessSatisfaction(fr, model) {
  const hasAddr = isFactComplete(fr.address, "address");
  const hasHours = isFactComplete(fr.hours, "hours");
  const hasMain = isFactComplete(fr.service_area_main, "service_area_main");
  const hasSurround = Array.isArray(fr.surrounding_cities?.value) && fr.surrounding_cities.value.length > 0 || ensureArrayStrings(fr.service_area_list?.value).length > 1;
  const exec = evaluateExecutionPathForAccess(fr);
  let checks = [];
  let satisfied = false;
  switch (model) {
    case "local_physical": {
      const hasBm = hasMeaningfulValue2(fr.booking_method?.value);
      checks = [
        { id: "address", ok: hasAddr },
        { id: "hours", ok: hasHours },
        ...hasBm ? [{ id: "execution_path", ok: exec.ok }] : []
      ];
      satisfied = hasAddr && hasHours && (!hasBm || exec.ok);
      break;
    }
    case "local_service_area":
      checks = [
        { id: "service_area_main", ok: hasMain },
        { id: "reach_or_path", ok: exec.ok }
      ];
      satisfied = hasMain && exec.ok;
      break;
    case "virtual_remote":
      checks = [{ id: "digital_reach", ok: exec.ok }];
      satisfied = exec.ok;
      break;
    case "hybrid":
    default:
      checks = [
        {
          id: "location_or_geo",
          ok: hasAddr || hasMain || hasSurround
        },
        { id: "action_path", ok: exec.ok }
      ];
      satisfied = (hasAddr || hasMain || hasSurround) && exec.ok;
      break;
  }
  const score = checks.length ? checks.filter((c) => c.ok).length / checks.length : 0;
  const failed = checks.find((c) => !c.ok);
  let missing_focus_id = failed?.id || null;
  if (missing_focus_id && ["action_path", "reach_or_path", "digital_reach", "execution_path"].includes(missing_focus_id) && exec.missing_focus_id) {
    missing_focus_id = exec.missing_focus_id;
  }
  return {
    satisfied,
    score: Number(score.toFixed(3)),
    checks,
    missing_focus_id
  };
}
__name(evaluateAccessSatisfaction, "evaluateAccessSatisfaction");
__name2(evaluateAccessSatisfaction, "evaluateAccessSatisfaction");
function buildAccessPlannerHint(access) {
  if (!access || access.satisfied) return null;
  const id = cleanString4(access.missing_focus_id);
  const map = {
    address: "contact_details",
    hours: "contact_details",
    service_area_main: "service_area",
    reach_or_path: "conversion",
    digital_reach: "conversion",
    action_path: "conversion",
    location_or_geo: "service_area",
    execution_path: "contact_details",
    phone_for_call: "contact_details",
    booking_url_live: "conversion"
  };
  return {
    missing_focus_id: id || null,
    decision_boost: map[id] || "contact_details"
  };
}
__name(buildAccessPlannerHint, "buildAccessPlannerHint");
__name2(buildAccessPlannerHint, "buildAccessPlannerHint");
function computeAccessReadiness(blueprint, state) {
  const fr = safeObject(blueprint.fact_registry);
  const bc = safeObject(blueprint?.strategy?.business_context);
  const provenanceBc = safeObject(state?.provenance?.strategy_contract?.business_context);
  const businessModelSignal = firstNonEmpty2([
    cleanString4(bc.business_model),
    cleanString4(provenanceBc.business_model)
  ]);
  const preflightMapped = mapPreflightBusinessModelToAccessModel(businessModelSignal);
  const model = inferAccessModel(blueprint, state);
  const sat = evaluateAccessSatisfaction(fr, model);
  const planner_hint = buildAccessPlannerHint({ ...sat, model, satisfied: sat.satisfied });
  return {
    spec_version: 1,
    model,
    satisfied: sat.satisfied,
    score: sat.score,
    checks: sat.checks,
    missing_focus_id: sat.missing_focus_id,
    planner_hint,
    business_model_signal: businessModelSignal || null,
    access_model_source: preflightMapped ? "preflight_business_model" : "inferred"
  };
}
__name(computeAccessReadiness, "computeAccessReadiness");
__name2(computeAccessReadiness, "computeAccessReadiness");
function applyAccessGateToConversionFields(decision, fields, accessReadiness) {
  const list = cleanList3(fields);
  if (!accessReadiness || accessReadiness.satisfied) return list;
  if (cleanString4(decision) !== "conversion") return list;
  if (!list.includes("pricing")) return list;
  return [...list.filter((f) => f !== "pricing"), "pricing"];
}
__name(applyAccessGateToConversionFields, "applyAccessGateToConversionFields");
__name2(applyAccessGateToConversionFields, "applyAccessGateToConversionFields");
var ACCESS_GATE_PRIMARY_FIELDS = /* @__PURE__ */ new Set([
  "booking_method",
  "booking_url",
  "contact_path",
  "phone",
  "email",
  "address",
  "hours",
  "service_area_main",
  "surrounding_cities"
]);
function isAccessPrimaryField(fieldKey) {
  return ACCESS_GATE_PRIMARY_FIELDS.has(cleanString4(fieldKey));
}
__name(isAccessPrimaryField, "isAccessPrimaryField");
__name2(isAccessPrimaryField, "isAccessPrimaryField");
var PREMIUM_COMPONENT_WEIGHTS = {
  contact: 1,
  hero: 0.85,
  features: 0.72,
  investment: 0.65,
  testimonials: 0.62,
  gallery: 0.55,
  faqs: 0.48,
  processSteps: 0.42,
  about: 0.38,
  service_area: 0.35,
  events: 0.28,
  comparison: 0.26
};
var PREMIUM_DECISION_IMPACT = {
  conversion: { contact: 0.95, hero: 0.35, investment: 0.12 },
  contact_details: { contact: 1 },
  positioning: { hero: 0.85, features: 0.8 },
  proof: { testimonials: 0.9, about: 0.28 },
  process: { processSteps: 1 },
  gallery_strategy: { gallery: 1, hero: 0.35 },
  pricing_model: { investment: 1, faqs: 0.18 },
  objection_handling: { faqs: 1 },
  story: { about: 1 },
  service_area: { service_area: 1 },
  events_strategy: { events: 0.75 },
  comparison_strategy: { comparison: 0.85 }
};
function premiumTierFromScore(score) {
  const s = Number(score) || 0;
  if (s >= 0.86) return "premium";
  if (s >= 0.55) return "partial";
  if (s <= 0.02) return "off";
  return "weak";
}
__name(premiumTierFromScore, "premiumTierFromScore");
__name2(premiumTierFromScore, "premiumTierFromScore");
function scoreHeroPremium(fr, draft) {
  const checks = [
    hasMeaningfulValue2(getByPath(draft, "hero.headline")),
    hasMeaningfulValue2(getByPath(draft, "hero.subtext")),
    hasMeaningfulValue2(getByPath(draft, "hero.image.image_search_query")),
    isFactComplete(fr.primary_offer, "primary_offer") && isFactComplete(fr.differentiation, "differentiation")
  ];
  return checks.filter(Boolean).length / checks.length;
}
__name(scoreHeroPremium, "scoreHeroPremium");
__name2(scoreHeroPremium, "scoreHeroPremium");
function scoreContactPremium(fr, draft) {
  const frObj = fr;
  const checks = [
    isFieldSatisfied("booking_method", frObj) && isFieldSatisfied("booking_url", frObj),
    isFactComplete(fr.phone, "phone") || isFactComplete(fr.email, "email"),
    hasMeaningfulValue2(firstNonEmpty2([fr.cta_text?.value, getByPath(draft, "contact.cta_text"), getByPath(draft, "settings.cta_text")])),
    isFactComplete(fr.contact_path, "contact_path") || isFactComplete(fr.hours, "hours") || hasMeaningfulValue2(getByPath(draft, "contact.text"))
  ];
  return checks.filter(Boolean).length / checks.length;
}
__name(scoreContactPremium, "scoreContactPremium");
__name2(scoreContactPremium, "scoreContactPremium");
function scoreFeaturesPremium(fr, draft) {
  const offer = isFactComplete(fr.primary_offer, "primary_offer");
  const diff = isFactComplete(fr.differentiation, "differentiation");
  const services = ensureArrayStrings(fr.service_list?.value);
  const feats = getByPath(draft, "features");
  const featN = Array.isArray(feats) ? feats.length : 0;
  const checks = [
    offer,
    diff,
    services.length >= 2 || featN >= 2,
    featN >= 3 || services.length >= 4
  ];
  return checks.filter(Boolean).length / checks.length;
}
__name(scoreFeaturesPremium, "scoreFeaturesPremium");
__name2(scoreFeaturesPremium, "scoreFeaturesPremium");
function scoreGalleryPremium(fr, draft) {
  const q = hasMeaningfulValue2(getByPath(draft, "gallery.image_source.image_search_query"));
  const layout = hasMeaningfulValue2(
    firstNonEmpty2([getByPath(draft, "gallery.computed_layout"), getByPath(draft, "gallery.layout")])
  );
  const countOk = typeof getByPath(draft, "gallery.computed_count") === "number" && getByPath(draft, "gallery.computed_count") >= 6;
  const direction = isFactComplete(fr.gallery_visual_direction, "gallery_visual_direction") || ensureArrayStrings(fr.image_themes?.value).length > 0;
  const checks = [q, layout, countOk || direction];
  return checks.filter(Boolean).length / checks.length;
}
__name(scoreGalleryPremium, "scoreGalleryPremium");
__name2(scoreGalleryPremium, "scoreGalleryPremium");
function scoreFaqsPremium(fr, draft) {
  const angles = ensureArrayStrings(fr.faq_angles?.value);
  const draftFaqs = getByPath(draft, "faqs");
  const n = Array.isArray(draftFaqs) ? draftFaqs.length : 0;
  const checks = [angles.length >= 3, n >= 3];
  return checks.filter(Boolean).length / checks.length;
}
__name(scoreFaqsPremium, "scoreFaqsPremium");
__name2(scoreFaqsPremium, "scoreFaqsPremium");
function scoreTestimonialsPremium(fr) {
  const quotes = ensureArrayStrings(fr.review_quotes?.value);
  const checks = [quotes.length >= 2, isFactComplete(fr.trust_signal, "trust_signal") || quotes.length >= 1];
  return checks.filter(Boolean).length / checks.length;
}
__name(scoreTestimonialsPremium, "scoreTestimonialsPremium");
__name2(scoreTestimonialsPremium, "scoreTestimonialsPremium");
function scoreProcessPremium(fr, draft) {
  const steps = getByPath(draft, "processSteps");
  const n = Array.isArray(steps) ? steps.length : 0;
  const summary = looksLikeProcessFact(fr.process_summary?.value);
  const checks = [n >= 3, summary];
  return checks.filter(Boolean).length / checks.length;
}
__name(scoreProcessPremium, "scoreProcessPremium");
__name2(scoreProcessPremium, "scoreProcessPremium");
function scoreAboutPremium(fr, draft) {
  let hits = 0;
  if (isFactComplete(fr.founder_story, "founder_story")) hits++;
  if (hasMeaningfulValue2(getByPath(draft, "about.story_text"))) hits++;
  if (isFactComplete(fr.years_experience, "years_experience")) hits++;
  if (hits >= 2) return 1;
  if (hits === 1) return 0.55;
  return 0;
}
__name(scoreAboutPremium, "scoreAboutPremium");
__name2(scoreAboutPremium, "scoreAboutPremium");
function scoreInvestmentPremium(fr, draft) {
  const pricingOk = isPricingComplete(fr);
  const inv = getByPath(draft, "investment");
  const invOk = Array.isArray(inv) && inv.length > 0;
  const checks = [pricingOk, invOk];
  return checks.filter(Boolean).length / checks.length;
}
__name(scoreInvestmentPremium, "scoreInvestmentPremium");
__name2(scoreInvestmentPremium, "scoreInvestmentPremium");
function scoreServiceAreaPremium(fr) {
  const main = isFactComplete(fr.service_area_main, "service_area_main");
  const sur = Array.isArray(fr.surrounding_cities?.value) && fr.surrounding_cities.value.length > 0 || ensureArrayStrings(fr.service_area_list?.value).length > 1;
  if (main && sur) return 1;
  if (main) return 0.62;
  return 0;
}
__name(scoreServiceAreaPremium, "scoreServiceAreaPremium");
__name2(scoreServiceAreaPremium, "scoreServiceAreaPremium");
function scoreEventsPremium(fr) {
  const ev = fr.events?.value;
  const n = Array.isArray(ev) ? ev.length : 0;
  if (n >= 3) return 1;
  if (n >= 1) return 0.45;
  return 0;
}
__name(scoreEventsPremium, "scoreEventsPremium");
__name2(scoreEventsPremium, "scoreEventsPremium");
function scoreComparisonPremium(fr) {
  return isFactComplete(fr.comparison, "comparison") ? 0.9 : 0;
}
__name(scoreComparisonPremium, "scoreComparisonPremium");
__name2(scoreComparisonPremium, "scoreComparisonPremium");
function pickNextPremiumUnlock(components, accessReadiness) {
  let pool = components;
  if (accessReadiness && accessReadiness.satisfied === false) {
    pool = {};
    for (const k of ["contact", "service_area"]) {
      if (components[k]) pool[k] = components[k];
    }
    if (!Object.keys(pool).length) pool = components;
  }
  let best = null;
  let bestUrgency = -1;
  for (const [id, row] of Object.entries(pool)) {
    const w = PREMIUM_COMPONENT_WEIGHTS[id] || 0.32;
    const gap = 1 - Number(row.score || 0);
    const urgency = gap * w;
    if (urgency > bestUrgency) {
      bestUrgency = urgency;
      best = {
        component: id,
        urgency: Number(urgency.toFixed(3)),
        gap: Number(gap.toFixed(3)),
        score: row.score
      };
    }
  }
  return best;
}
__name(pickNextPremiumUnlock, "pickNextPremiumUnlock");
__name2(pickNextPremiumUnlock, "pickNextPremiumUnlock");
function computePremiumReadinessEngine(blueprint) {
  const fr = safeObject(blueprint.fact_registry);
  const draft = safeObject(blueprint.business_draft);
  const access = blueprint.access_readiness;
  const components = {
    hero: { score: scoreHeroPremium(fr, draft), missing: [] },
    contact: { score: scoreContactPremium(fr, draft), missing: [] },
    features: { score: scoreFeaturesPremium(fr, draft), missing: [] },
    gallery: { score: scoreGalleryPremium(fr, draft), missing: [] },
    faqs: { score: scoreFaqsPremium(fr, draft), missing: [] },
    testimonials: { score: scoreTestimonialsPremium(fr), missing: [] },
    processSteps: { score: scoreProcessPremium(fr, draft), missing: [] },
    about: { score: scoreAboutPremium(fr, draft), missing: [] },
    investment: { score: scoreInvestmentPremium(fr, draft), missing: [] },
    service_area: { score: scoreServiceAreaPremium(fr), missing: [] },
    events: { score: scoreEventsPremium(fr), missing: [] },
    comparison: { score: scoreComparisonPremium(fr), missing: [] }
  };
  for (const [id, row] of Object.entries(components)) {
    row.tier = premiumTierFromScore(row.score);
  }
  const next_unlock = pickNextPremiumUnlock(components, access);
  const ordered = Object.entries(components).map(([id, row]) => ({
    component: id,
    score: row.score,
    tier: row.tier,
    weighted_gap: Number(((1 - row.score) * (PREMIUM_COMPONENT_WEIGHTS[id] || 0.3)).toFixed(3))
  })).sort((a, b) => b.weighted_gap - a.weighted_gap);
  const avg = Object.values(components).reduce((s, x) => s + x.score, 0) / Math.max(1, Object.keys(components).length);
  return {
    spec_version: 1,
    components,
    next_unlock,
    ordered_by_impact: ordered,
    access_gate: access ? {
      satisfied: !!access.satisfied,
      model: access.model,
      score: access.score,
      missing_focus_id: access.missing_focus_id || null,
      planner_hint: access.planner_hint || null,
      business_model_signal: access.business_model_signal || null,
      access_model_source: access.access_model_source || null
    } : null,
    summary: {
      avg_score: Number(avg.toFixed(3)),
      weakest: ordered[0] || null,
      access_satisfied: access ? !!access.satisfied : true,
      access_model: access?.model || null
    }
  };
}
__name(computePremiumReadinessEngine, "computePremiumReadinessEngine");
__name2(computePremiumReadinessEngine, "computePremiumReadinessEngine");
function premiumUnlockBoostForDecision(decision, premiumReadiness) {
  const impact = PREMIUM_DECISION_IMPACT[cleanString4(decision)];
  if (!impact || !premiumReadiness?.components) return 0;
  const focusComp = cleanString4(premiumReadiness.next_unlock?.component);
  let boost = 0;
  for (const [comp, coupling] of Object.entries(impact)) {
    const row = premiumReadiness.components[comp];
    if (!row) continue;
    const gap = 1 - Number(row.score || 0);
    const globalW = PREMIUM_COMPONENT_WEIGHTS[comp] || 0.35;
    const focus = focusComp && focusComp === comp ? 1.42 : 1;
    boost += gap * coupling * globalW * 58 * focus;
  }
  return Math.round(Math.min(96, boost));
}
__name(premiumUnlockBoostForDecision, "premiumUnlockBoostForDecision");
__name2(premiumUnlockBoostForDecision, "premiumUnlockBoostForDecision");
function hasLocationSignalsForServiceArea(factRegistry, state, blueprint) {
  if (hasMeaningfulValue2(factRegistry?.service_area_main?.value)) return true;
  if (hasMeaningfulValue2(factRegistry?.address?.value)) return true;
  const pi = safeObject(state?.preflight_intelligence);
  const sa = pi.service_area;
  if (Array.isArray(sa) && sa.some((x) => hasMeaningfulValue2(x))) return true;
  if (typeof sa === "string" && cleanString4(sa)) return true;
  const bc = safeObject(blueprint?.strategy?.business_context) || safeObject(state?.provenance?.strategy_contract?.business_context);
  const bsa = bc?.service_area;
  if (Array.isArray(bsa) && bsa.some((x) => cleanString4(x))) return true;
  return typeof bsa === "string" && !!cleanString4(bsa);
}
__name(hasLocationSignalsForServiceArea, "hasLocationSignalsForServiceArea");
__name2(hasLocationSignalsForServiceArea, "hasLocationSignalsForServiceArea");
function differentiationPrereqSignalMet(factRegistry) {
  const fr = safeObject(factRegistry);
  if (isFieldSatisfied("differentiation", fr)) return true;
  const t = cleanString4(stringifyFactValue(fr?.differentiation?.value)).trim();
  if (!t) return false;
  return t.split(/\s+/).filter(Boolean).length >= 4;
}
__name(differentiationPrereqSignalMet, "differentiationPrereqSignalMet");
__name2(differentiationPrereqSignalMet, "differentiationPrereqSignalMet");
function conversionPositioningPrereqsMet(factRegistry) {
  const fr = safeObject(factRegistry);
  return isFieldSatisfied("primary_offer", fr) && differentiationPrereqSignalMet(fr);
}
__name(conversionPositioningPrereqsMet, "conversionPositioningPrereqsMet");
__name2(conversionPositioningPrereqsMet, "conversionPositioningPrereqsMet");
function computeDynamicPriority(fieldKey, blueprint, state, rounds) {
  const fk = cleanString4(fieldKey);
  if (!fk) return 0;
  const r = Number(rounds) || 0;
  if (r === 0) {
    const allowedFirstFields = ["differentiation", "primary_offer", "target_persona"];
    if (!allowedFirstFields.includes(fk)) {
      return -9999;
    }
  }
  const fr = safeObject(blueprint?.fact_registry);
  const conversionChannelFields = ["booking_method", "contact_path", "booking_url"];
  if (conversionChannelFields.includes(fk) && !conversionPositioningPrereqsMet(fr)) {
    return -9999;
  }
  const decisionStates = blueprint?.decision_states || {};
  const componentStates = blueprint?.component_states || {};
  const premium = blueprint?.premium_readiness || {};
  const access = blueprint?.access_readiness || {};
  let score = 0;
  Object.values(decisionStates).forEach((ds) => {
    if (!Array.isArray(ds?.missing_evidence) || !ds.missing_evidence.some((k) => cleanString4(k) === fk)) {
      return;
    }
    const fact = fr[fk];
    const needsValidation = cleanString4(fact?.status) !== "verified" || fact?.needs_validation === true;
    if (needsValidation) {
      score += Number(ds.priority || 0);
    }
  });
  Object.values(componentStates).forEach((comp) => {
    if (comp?.enabled && Array.isArray(comp?.evidence_keys) && comp.evidence_keys.some((k) => cleanString4(k) === fk)) {
      score += Number(comp.planner_priority || 0);
    }
  });
  const premiumOrder = premium?.ordered_by_impact || [];
  premiumOrder.forEach((item, index) => {
    const comp = componentStates?.[item.component];
    if (comp?.evidence_keys?.some((k) => cleanString4(k) === fk)) {
      score += (premiumOrder.length - index) * 15;
    }
  });
  if (["booking_method", "contact_path", "booking_url"].includes(fk) && r < 2) {
    score -= 150;
  }
  if (["phone", "address", "hours"].includes(fk) && r < 3) {
    score -= 150;
  }
  if (!access?.satisfied && r >= 3 && fk === cleanString4(access?.missing_focus_id)) {
    score += 200;
  }
  if (fk === "primary_offer") {
    const offerVal = stringifyFactValue(fr.primary_offer?.value);
    if (getOfferStrength(offerVal) === "weak") {
      score += 22;
    }
  }
  return score;
}
__name(computeDynamicPriority, "computeDynamicPriority");
__name2(computeDynamicPriority, "computeDynamicPriority");
function pickPrimaryFieldFromUnresolved(fields, blueprint, state) {
  if (!Array.isArray(fields) || fields.length === 0) return null;
  const rounds = Array.isArray(blueprint?.question_history) ? blueprint.question_history.length : 0;
  let bestField = null;
  let bestScore = -Infinity;
  for (const rawField of fields) {
    const fieldKey = cleanString4(rawField);
    const score = computeDynamicPriority(fieldKey, blueprint, state, rounds);
    if (score > bestScore) {
      bestScore = score;
      bestField = fieldKey;
    }
  }
  return bestField;
}
__name(pickPrimaryFieldFromUnresolved, "pickPrimaryFieldFromUnresolved");
__name2(pickPrimaryFieldFromUnresolved, "pickPrimaryFieldFromUnresolved");
function buildQuestionCandidates({ blueprint, previousPlan, lastAudit, state }) {
  const candidates = [];
  const decisionStates = safeObject(blueprint.decision_states);
  const factRegistry = safeObject(blueprint.fact_registry);
  const componentStates = safeObject(blueprint.component_states);
  const accessReadiness = blueprint.access_readiness || computeAccessReadiness(blueprint, state);
  const premiumReadiness = blueprint.premium_readiness || computePremiumReadinessEngine({ ...blueprint, access_readiness: accessReadiness });
  const questionHistory = Array.isArray(blueprint.question_history) ? blueprint.question_history : [];
  const askedTurns = questionHistory.length;
  let conversionTargetFieldsOrdered = applyAccessGateToConversionFields(
    "conversion",
    cleanList3(getDecisionTargets()?.conversion?.target_fields).filter(
      (field) => Object.prototype.hasOwnProperty.call(factRegistry, field)
    ),
    accessReadiness
  );
  if (!conversionPositioningPrereqsMet(factRegistry)) {
    const gatedConv = /* @__PURE__ */ new Set(["booking_method", "booking_url", "contact_path"]);
    conversionTargetFieldsOrdered = conversionTargetFieldsOrdered.filter((f) => !gatedConv.has(cleanString4(f)));
  }
  const conversionUnresolvedCount = conversionTargetFieldsOrdered.filter(
    (field) => !isFieldSatisfied(field, factRegistry)
  ).length;
  const decisionTargets = getDecisionTargets();
  for (const [decision, config] of Object.entries(decisionTargets)) {
    const decisionState = decisionStates[decision] || {};
    const rawTargetFields = cleanList3(config.target_fields).filter(
      (field) => Object.prototype.hasOwnProperty.call(factRegistry, field)
    );
    let targetFields = applyAccessGateToConversionFields(decision, rawTargetFields, accessReadiness);
    if (decision === "conversion" && !conversionPositioningPrereqsMet(factRegistry)) {
      const gatedConv = /* @__PURE__ */ new Set(["booking_method", "booking_url", "contact_path"]);
      targetFields = targetFields.filter((f) => !gatedConv.has(cleanString4(f)));
    }
    let unresolvedFields = targetFields.filter((field) => !isFieldSatisfied(field, factRegistry));
    if (decision === "service_area") {
      unresolvedFields = unresolvedFields.filter((field) => {
        if (field !== "service_area_main") return true;
        return !hasLocationSignalsForServiceArea(factRegistry, state, blueprint);
      });
    }
    if (unresolvedFields.some((fk) => cleanString4(factRegistry[fk]?.status) === "prefilled_unverified")) {
      const orderIdx = /* @__PURE__ */ __name2((fk) => {
        const i = targetFields.indexOf(fk);
        return i < 0 ? 9999 : i;
      }, "orderIdx");
      unresolvedFields = unresolvedFields.slice().sort((a, b) => {
        const pa = cleanString4(factRegistry[a]?.status) === "prefilled_unverified" ? 0 : 1;
        const pb = cleanString4(factRegistry[b]?.status) === "prefilled_unverified" ? 0 : 1;
        if (pa !== pb) return pa - pb;
        return orderIdx(a) - orderIdx(b);
      });
    }
    const relatedComponents = cleanList3(config.components).filter(
      (component) => componentStates[component]?.enabled || componentStates[component]?.required
    );
    if (decision === "conversion") {
      if (!targetFields.length) continue;
      if (!unresolvedFields.length) continue;
    }
    if (!unresolvedFields.length && Number(decisionState.confidence || 0) >= 0.8) continue;
    const askedCounts = {};
    for (const entry of questionHistory) {
      if (cleanString4(entry.bundle_id) === decision) {
        const field = cleanString4(entry.primary_field);
        if (field) askedCounts[field] = (askedCounts[field] || 0) + 1;
      }
    }
    const updatedFactsThisTurn = cleanList3(lastAudit?.updated_fact_keys);
    const stalledFields = unresolvedFields.filter((field) => {
      const asked = Number(askedCounts[field] || 0);
      const justUpdated = updatedFactsThisTurn.includes(field);
      return asked >= 2 && !justUpdated;
    });
    if (stalledFields.length) {
      unresolvedFields = unresolvedFields.filter((field) => !stalledFields.includes(field)).concat(stalledFields);
    }
    const primaryPick = unresolvedFields.length > 0 ? pickPrimaryFieldFromUnresolved(unresolvedFields, blueprint, state) : "";
    const nextPrimaryField = cleanString4(primaryPick || unresolvedFields[0] || targetFields[0]);
    const bypassAccessForPrefill = unresolvedFields.some(
      (fk) => cleanString4(factRegistry[fk]?.status) === "prefilled_unverified"
    );
    if (accessReadiness && accessReadiness.satisfied === false && unresolvedFields.length > 0 && nextPrimaryField && !isAccessPrimaryField(nextPrimaryField) && !bypassAccessForPrefill) {
      continue;
    }
    let score = Number(config.base_priority || 100);
    score += premiumUnlockBoostForDecision(decision, premiumReadiness);
    const plannerHint = accessReadiness?.planner_hint;
    if (accessReadiness && accessReadiness.satisfied === false && plannerHint?.decision_boost === decision) {
      score += 62;
    }
    score += unresolvedFields.length * 35;
    score += relatedComponents.filter((component) => !componentStates[component]?.draft_ready).length * 18;
    score += relatedComponents.filter((component) => !componentStates[component]?.premium_ready).length * 10;
    score += Math.round((1 - Number(decisionState.confidence || 0)) * 100);
    if (hasVisualInferenceSignals(factRegistry) && rawTargetFields.some((f) => f === "image_themes" || f === "gallery_visual_direction")) {
      score -= 200;
    }
    if (decision === "contact_details" && coreDecisionsStillWeak(decisionStates)) {
      if (accessReadiness && accessReadiness.satisfied === false) {
        score += 28;
      } else {
        score -= 140;
      }
    }
    if (askedTurns < 4 && conversionUnresolvedCount > 0 && decision !== "conversion") {
      if (accessReadiness && accessReadiness.satisfied === false && (decision === "service_area" || decision === "contact_details")) {
      } else {
        score -= 52;
      }
    }
    if (decision === "service_area" && coreDecisionsStillWeak(decisionStates)) {
      if (!(accessReadiness && accessReadiness.satisfied === false && accessReadiness.model === "local_service_area")) {
        score -= 90;
      }
    }
    if (decision === cleanString4(previousPlan?.bundle_id)) {
      score += 45;
    }
    if (stalledFields.length && unresolvedFields.length === stalledFields.length) {
      score -= 60;
    }
    const completionRows = targetFields.map((fk) => factRegistry[fk]).filter((fact) => isObject3(fact) && hasMeaningfulValue2(fact.value));
    const verifiedCount = completionRows.filter(
      (fact) => fact.verified === true || cleanString4(fact.status) === "verified"
    ).length;
    const verifiedRatio = completionRows.length ? verifiedCount / completionRows.length : 0;
    if (verifiedRatio >= 0.75) {
      score -= 140;
    } else if (verifiedRatio >= 0.5) {
      score -= 80;
    }
    const narrativeReadinessGaps = {
      who_its_for: !isFactResolved(factRegistry.target_persona, "target_persona"),
      process_clarity: !isFactResolved(factRegistry.process_summary),
      service_specificity: !isFactResolved(factRegistry.primary_offer),
      faq_substance: !isFactResolved(factRegistry.faq_angles)
    };
    if (decision === "positioning") {
      if (narrativeReadinessGaps.who_its_for) score += 30;
      if (narrativeReadinessGaps.service_specificity) score += 25;
    } else if (decision === "process" && narrativeReadinessGaps.process_clarity) {
      score += 30;
    } else if (decision === "objection_handling" && narrativeReadinessGaps.faq_substance) {
      score += 20;
    }
    const strategicPrimary = ["differentiation", "target_persona", "primary_offer", "pricing"];
    const contactNapFields = ["phone", "address", "hours"];
    if (primaryPick && strategicPrimary.includes(primaryPick)) {
      score += 70;
    }
    if (primaryPick && contactNapFields.includes(primaryPick) && askedTurns < 3) {
      score -= 95;
    }
    candidates.push({
      bundle_id: decision,
      score,
      target_fields: targetFields,
      unresolved_fields: unresolvedFields,
      target_sections: relatedComponents,
      primary_field: cleanString4(primaryPick || unresolvedFields[0] || targetFields[0] || ""),
      intent: cleanString4(config.intent),
      reason: cleanString4(config.reason),
      tone: "consultative"
    });
  }
  return candidates.sort((a, b) => b.score - a.score);
}
__name(buildQuestionCandidates, "buildQuestionCandidates");
__name2(buildQuestionCandidates, "buildQuestionCandidates");
function isPricingComplete(factRegistry) {
  const pricing = factRegistry?.pricing;
  if (!pricing || !hasMeaningfulValue2(pricing.value)) return false;
  const value = cleanString4(pricing.value).toLowerCase();
  if (value.includes("quote") || value.includes("custom") || value.includes("based on") || value.includes("depends") || value.includes("estimate")) {
    return true;
  }
  if (value.includes("size") || value.includes("complexity") || value.includes("scope") || value.includes("windows") || value.includes("home")) {
    return true;
  }
  return false;
}
__name(isPricingComplete, "isPricingComplete");
__name2(isPricingComplete, "isPricingComplete");
function isFactCapturedForPlanning(fact, fieldKey = "") {
  if (!isObject3(fact)) return false;
  if (cleanString4(fieldKey) === "booking_url" && isBookingUrlResolved(fact)) return true;
  if (cleanString4(fieldKey) === "primary_offer") {
    const st = cleanString4(fact.status).toLowerCase();
    return st === "answered" || st === "verified";
  }
  const status = cleanString4(fact.status).toLowerCase();
  if (status === "answered" || status === "verified") return true;
  const c = typeof fact.confidence === "number" ? fact.confidence : 0;
  return c > 0.85;
}
__name(isFactCapturedForPlanning, "isFactCapturedForPlanning");
__name2(isFactCapturedForPlanning, "isFactCapturedForPlanning");
function planNextQuestion(candidates, _previousBundleId, _previousPrimaryField, _factRegistry, blueprint, state) {
  if (!Array.isArray(candidates) || candidates.length === 0) return null;
  const rounds = Array.isArray(blueprint?.question_history) ? blueprint.question_history.length : 0;
  const factRegistry = safeObject(blueprint?.fact_registry);
  const allFields = [];
  for (const candidate of candidates || []) {
    const fields = candidate?.target_fields || [];
    for (const field of fields) {
      const fk = cleanString4(field);
      if (!fk) continue;
      if (isFactCapturedForPlanning(factRegistry[fk], fk)) continue;
      allFields.push({
        field: fk,
        bundle: candidate.bundle_id
      });
    }
  }
  if (allFields.length === 0) {
    throw new Error("No fields available for selection in planNextQuestion");
  }
  let best = null;
  let bestScore = -Infinity;
  for (const item of allFields) {
    const score = computeDynamicPriority(item.field, blueprint, state, rounds);
    if (score > bestScore) {
      bestScore = score;
      best = item;
    }
  }
  if (!best) return null;
  const sourceCandidate = candidates.find(
    (c) => (c.target_fields || []).some((f) => cleanString4(f) === best.field)
  );
  const rawTargets = sourceCandidate?.target_fields || [best.field];
  const target_fields = cleanList3(rawTargets).filter((f) => {
    const k = cleanString4(f);
    return k && !isFactCapturedForPlanning(factRegistry[k], k);
  });
  return {
    bundle_id: cleanString4(best.bundle),
    primary_field: best.field,
    target_fields: target_fields.length ? target_fields : [best.field],
    intent: "field-first",
    reason: "dynamic_priority_selection",
    tone: "consultative"
  };
}
__name(planNextQuestion, "planNextQuestion");
__name2(planNextQuestion, "planNextQuestion");
function evaluateBlueprintReadiness(blueprint) {
  const componentStates = safeObject(blueprint.component_states);
  const factRegistry = safeObject(blueprint.fact_registry);
  const bookingMethodRaw = cleanString4(factRegistry?.booking_method?.value);
  const bookingMethod = bookingMethodRaw ? bookingMethodRaw.toLowerCase() : "";
  const bookingUrlResolved = isBookingUrlResolved(factRegistry?.booking_url);
  const contactPathResolved = isFactComplete(factRegistry?.contact_path, "contact_path") || hasMeaningfulValue2(getByPath(blueprint.business_draft, "contact.cta_link")) || hasMeaningfulValue2(getByPath(blueprint.business_draft, "settings.cta_link"));
  const manualBooking = isManualBookingMethodValue(bookingMethodRaw);
  const conversionResolved = hasMeaningfulValue2(bookingMethod) && (bookingUrlResolved || manualBooking) && contactPathResolved;
  const hasPositioning = isFieldSatisfied("target_persona", factRegistry) && isFactComplete(factRegistry?.differentiation, "differentiation");
  const hasProof = Array.isArray(factRegistry?.review_quotes?.value) && factRegistry.review_quotes.value.length > 0 || isFactComplete(factRegistry?.years_experience, "years_experience");
  const hasServiceArea = isFactComplete(factRegistry?.service_area_main, "service_area_main") || Array.isArray(factRegistry?.surrounding_cities?.value) && factRegistry.surrounding_cities.value.length > 0;
  const hasContact = isFactComplete(factRegistry?.phone, "phone") || isFactComplete(factRegistry?.email, "email");
  const canGenerate = conversionResolved && hasPositioning && hasProof && hasContact && hasServiceArea;
  const minimumViable = {
    brand_name: hasMeaningfulValue2(getByPath(blueprint.business_draft, "brand.name")),
    hero_headline: hasMeaningfulValue2(
      getByPath(blueprint.business_draft, "hero.headline")
    ),
    hero_subtext: hasMeaningfulValue2(
      getByPath(blueprint.business_draft, "hero.subtext")
    ),
    features: Array.isArray(getByPath(blueprint.business_draft, "features")) && getByPath(blueprint.business_draft, "features").length >= 1,
    contact_button: hasMeaningfulValue2(getByPath(blueprint.business_draft, "contact.button_text")) || hasMeaningfulValue2(getByPath(blueprint.business_draft, "contact.cta_text")),
    // 🔥 conversion must also pass strong gating
    // 🔥 CLEANED
    conversion: conversionResolved
  };
  const premiumSignals = {
    proof: componentStates.trustbar?.enabled || componentStates.testimonials?.enabled,
    visuals: componentStates.gallery?.premium_ready || componentStates.hero?.premium_ready,
    process: componentStates.processSteps?.enabled ? componentStates.processSteps?.draft_ready : true,
    story: componentStates.about?.enabled ? componentStates.about?.draft_ready : true,
    geo: componentStates.service_area?.enabled ? componentStates.service_area?.draft_ready : true
  };
  const minimumViablePassed = Object.values(minimumViable).every(Boolean);
  const premiumReadyPassed = minimumViablePassed && Object.values(premiumSignals).every(Boolean);
  const minimumScore = Object.values(minimumViable).filter(Boolean).length / Object.values(minimumViable).length;
  const premiumScore = Object.values(premiumSignals).filter(Boolean).length / Object.values(premiumSignals).length;
  const rawScore = minimumScore * 0.6 + premiumScore * 0.4;
  const finalScore = canGenerate ? rawScore : Math.min(rawScore, 0.92);
  return {
    minimum_viable_preview: minimumViablePassed,
    premium_ready_preview: premiumReadyPassed,
    // 🔥 TRUE readiness (fixed)
    can_generate_now: canGenerate,
    score: Number(finalScore.toFixed(2)),
    minimum_viable_detail: minimumViable,
    premium_ready_detail: premiumSignals,
    conversion_debug: {
      bookingMethod,
      bookingUrlResolved,
      manualBooking,
      contactPathResolved,
      conversionResolved,
      hasPositioning,
      hasProof,
      hasContact,
      canGenerate
    }
  };
}
__name(evaluateBlueprintReadiness, "evaluateBlueprintReadiness");
__name2(evaluateBlueprintReadiness, "evaluateBlueprintReadiness");
var REINFORCEMENT_STOPWORDS = /* @__PURE__ */ new Set([
  "that",
  "this",
  "with",
  "from",
  "they",
  "have",
  "been",
  "were",
  "your",
  "their",
  "there",
  "what",
  "when",
  "where",
  "which",
  "would",
  "could",
  "about",
  "into",
  "just",
  "also",
  "very",
  "some",
  "than",
  "then",
  "them",
  "such",
  "each",
  "other",
  "more",
  "most",
  "many",
  "much",
  "well",
  "only",
  "even",
  "like",
  "make",
  "does",
  "done",
  "being",
  "over",
  "after",
  "before"
]);
var REINFORCEMENT_OVERLAP_THRESHOLD = 0.38;
function reinforcementTokensFromAnswer(answerText) {
  return new Set(
    cleanString4(answerText).toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length >= 4 && !REINFORCEMENT_STOPWORDS.has(w))
  );
}
__name(reinforcementTokensFromAnswer, "reinforcementTokensFromAnswer");
__name2(reinforcementTokensFromAnswer, "reinforcementTokensFromAnswer");
function significantTokensFromInsight(insightText) {
  return cleanString4(insightText).toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length >= 4 && !REINFORCEMENT_STOPWORDS.has(w));
}
__name(significantTokensFromInsight, "significantTokensFromInsight");
__name2(significantTokensFromInsight, "significantTokensFromInsight");
function reinforcementOverlapRatio(answerText, insightText) {
  const answerTok = reinforcementTokensFromAnswer(answerText);
  const insightToks = significantTokensFromInsight(insightText);
  if (insightToks.length === 0) return 0;
  let hit = 0;
  for (const w of insightToks) {
    if (answerTok.has(w)) hit += 1;
  }
  return hit / insightToks.length;
}
__name(reinforcementOverlapRatio, "reinforcementOverlapRatio");
__name2(reinforcementOverlapRatio, "reinforcementOverlapRatio");
function evaluatePositiveReinforcement({
  combinedAnswer,
  preflightIntelligence,
  lastTurnReinforcementSource
}) {
  const text = cleanString4(combinedAnswer);
  const pi = isObject3(preflightIntelligence) ? preflightIntelligence : null;
  if (!text || !pi) return null;
  const candidates = [];
  const wa = cleanString4(pi.winning_angle);
  if (wa) candidates.push({ source: "winning_local_angle", text: wa });
  const hyp = cleanString4(pi.differentiation_hypothesis);
  if (hyp) candidates.push({ source: "differentiation_hypothesis", text: hyp });
  for (const line of cleanList3(pi.buyer_factors)) {
    const b = cleanString4(line);
    if (b) candidates.push({ source: "buyer_comparison_factors", text: b });
  }
  const messages = {
    winning_local_angle: "That actually lines up well with what makes you stand out locally.",
    differentiation_hypothesis: "That fits the positioning we're seeing for you.",
    buyer_comparison_factors: "That matches how buyers in your space often weigh their options."
  };
  for (const c of candidates) {
    if (cleanString4(c.source) === cleanString4(lastTurnReinforcementSource)) continue;
    if (reinforcementOverlapRatio(text, c.text) < REINFORCEMENT_OVERLAP_THRESHOLD) continue;
    return {
      type: "positive_alignment",
      message: messages[c.source],
      source: c.source
    };
  }
  return null;
}
__name(evaluatePositiveReinforcement, "evaluatePositiveReinforcement");
__name2(evaluatePositiveReinforcement, "evaluatePositiveReinforcement");
function appendReinforcementToAssistantMessage(reinforcement, assistantMessage) {
  const base = cleanString4(assistantMessage);
  const note = cleanString4(reinforcement?.message);
  if (!note) return base;
  if (!base) return note;
  return `${note}

${base}`;
}
__name(appendReinforcementToAssistantMessage, "appendReinforcementToAssistantMessage");
__name2(appendReinforcementToAssistantMessage, "appendReinforcementToAssistantMessage");
var PRICING_BRIDGE_INSTRUCTION = "Ask ONLY how pricing or quoting works for their work (one topic; no booking channel or URL).";
function buildPricingFramingSentence(pi) {
  if (!isObject3(pi)) return "";
  const frame = /* @__PURE__ */ __name2((sentence, max = 340) => truncate2(cleanString4(sentence), max), "frame");
  const weak = cleanList3(pi.weaknesses).map((w) => cleanString4(w)).filter(Boolean);
  const buyers = cleanList3(pi.buyer_factors).map((x) => cleanString4(x)).filter(Boolean);
  const alts = cleanList3(pi.local_alternatives).map((a) => cleanString4(a)).filter(Boolean);
  const focus = cleanList3(pi.recommended_focus).map((f) => cleanString4(f)).filter(Boolean);
  const hyp = cleanString4(pi.differentiation_hypothesis);
  const pos = cleanString4(pi.positioning);
  const opp = cleanString4(pi.opportunity);
  const angle = cleanString4(pi.winning_angle);
  if (weak.length && hyp) {
    return frame(
      `Buyers feel ${weak[0]}; your pricing should reflect this clearly: ${hyp}.`
    );
  }
  if (weak.length >= 2) {
    return frame(
      `The tension is ${weak[0]} versus ${weak[1]} \u2014 your quote rules should show which side you own.`
    );
  }
  if (weak.length && buyers.length) {
    return frame(
      `They compare on ${buyers.slice(0, 2).join(" and ")} while peers often show ${weak[0]}.`
    );
  }
  if (weak.length) {
    return frame(
      `Peers often stumble on ${weak[0]}; spell how you price so that gap is obvious.`
    );
  }
  if (alts.length && hyp) {
    const vs = alts.slice(0, 2).join(" and ");
    return frame(
      `Against ${vs}, this is the kind of value your pricing should communicate: ${hyp}.`
    );
  }
  if (alts.length && buyers.length) {
    const vs = alts.slice(0, 2).join(" and ");
    return frame(
      buyers[1] ? `Versus ${vs}, the tradeoff is ${buyers[0]} versus ${buyers[1]} \u2014 quotes should show which side you own.` : `Versus ${vs}, buyers still judge on ${buyers[0]} \u2014 make pricing pick a side.`
    );
  }
  if (focus.length >= 2) {
    return frame(
      `The pull is between ${focus[0]} and ${focus[1]} \u2014 align quotes with the tradeoff you're choosing.`
    );
  }
  if (focus.length) {
    return frame(`Your quotes should foreground this: ${focus[0]}.`);
  }
  if (hyp) {
    return frame(`Your pricing should reflect this clearly: ${hyp}.`);
  }
  if (alts.length && angle) {
    const vs = alts[0];
    return frame(
      `You win locally when ${angle} \u2014 how do your quotes usually reflect that compared to ${vs}?`
    );
  }
  if (angle) {
    return frame(`You win locally when ${angle} \u2014 align quotes with that promise.`);
  }
  if (pos) {
    return frame(`Against generic options, the read is ${pos} \u2014 make quoting match that stance.`);
  }
  if (buyers.length) {
    return frame(
      `Buyers weigh ${buyers.slice(0, 3).join(", ")} \u2014 clarify how your quotes work.`
    );
  }
  if (opp) {
    return frame(opp, 220);
  }
  return "";
}
__name(buildPricingFramingSentence, "buildPricingFramingSentence");
__name2(buildPricingFramingSentence, "buildPricingFramingSentence");
function buildPricingPreflightNarrative(pi, { maxChars = 400, withPricingInstruction = false } = {}) {
  const tail = withPricingInstruction ? ` ${PRICING_BRIDGE_INSTRUCTION}` : "";
  const budget = Math.max(80, maxChars - tail.length);
  const body = truncate2(buildPricingFramingSentence(pi), budget) + tail;
  return body.trim();
}
__name(buildPricingPreflightNarrative, "buildPricingPreflightNarrative");
__name2(buildPricingPreflightNarrative, "buildPricingPreflightNarrative");
var EXPERT_LEAD_MAX = 180;
function squeezeExpertLead(parts, maxLead = EXPERT_LEAD_MAX) {
  const cleaned = parts.map((p) => cleanString4(p)).filter(Boolean);
  let list = cleaned.slice();
  while (list.length > 1 && list.join(" ").length > maxLead) {
    list.pop();
  }
  let lead = list.join(" ").trim();
  if (lead.length > maxLead) {
    lead = truncate2(lead, maxLead);
  }
  return lead;
}
__name(squeezeExpertLead, "squeezeExpertLead");
__name2(squeezeExpertLead, "squeezeExpertLead");
function buildExpertMessage({ lead, question }) {
  const q = cleanString4(question);
  const l = cleanString4(lead);
  if (!q) return l;
  if (!l) return q;
  return `${l}

${q}`;
}
__name(buildExpertMessage, "buildExpertMessage");
__name2(buildExpertMessage, "buildExpertMessage");
function buildInterpretation(primaryField, pi, blueprint, extras = {}) {
  const pf = cleanString4(primaryField);
  const p = isObject3(pi) ? pi : null;
  const opp = p ? cleanString4(p.opportunity) : "";
  const pos = p ? cleanString4(p.positioning) : "";
  const bc = safeObject(blueprint?.strategy?.business_context);
  const cat = cleanString4(bc.category).toLowerCase();
  const blob = [cat, opp, pos].join(" ");
  if (pf === "phone") {
    if (extras.callHeavy) {
      return "For most customers, this is where they decide whether to move forward\u2014they usually just want to call and get a clear answer.";
    }
    return "People bounce when contact feels vague; this line should match how you actually want to be reached.";
  }
  if (pf === "email") {
    return "Serious buyers often test the waters by email first\u2014they're deciding if you sound real and responsive.";
  }
  if (pf === "address") {
    const kind = extras.accessKind || expertAccessKind(blueprint, pi);
    if (kind === "local_physical") {
      return "Walk-ins and map checks are where people either commit or bounce\u2014clarity here is trust.";
    }
    if (kind === "local_service_area") {
      return "Most people sanity-check where you're based or who you serve before they bother reaching out.";
    }
    if (kind === "virtual_remote") {
      return "Remote buyers still look for a real anchor\u2014location or base helps them picture who they're hiring.";
    }
    return "The right location line filters the wrong fits and reassures the right ones.";
  }
  if (pf === "hours") {
    return "Nobody likes guessing whether you're reachable\u2014hours set expectations before the first hello.";
  }
  if (pf === "process_summary") {
    const tangible = extras.tangible ?? /\b(fram|gallery|print|custom|art|piece|studio|bespoke)\b/i.test(blob);
    if (tangible) {
      return "Most people aren't buying a transaction\u2014they're trusting you with something that matters to them.";
    }
    return "The experience is often what they're really evaluating\u2014the deliverable is only part of the story.";
  }
  if (pf === "review_quotes") {
    return "Trust usually only clicks once someone can picture the outcome\u2014not before.";
  }
  if (pf === "trust_signal") {
    return "People rarely bet on promises alone\u2014they look for proof they can believe.";
  }
  return null;
}
__name(buildInterpretation, "buildInterpretation");
__name2(buildInterpretation, "buildInterpretation");
function expertAccessKind(blueprint, pi) {
  const bc = safeObject(blueprint?.strategy?.business_context);
  const pre = mapPreflightBusinessModelToAccessModel(bc.business_model);
  if (pre === "local_physical") return "local_physical";
  if (pre === "local_service_area") return "local_service_area";
  if (pre === "virtual_remote") return "virtual_remote";
  if (pre === "hybrid") return "hybrid";
  const p = isObject3(pi) ? pi : {};
  const blob = [cleanString4(bc.category), cleanString4(p.positioning), cleanString4(p.opportunity)].join(" ").toLowerCase();
  const cat = cleanString4(bc.category).toLowerCase();
  if (/\b(gallery|retail|restaurant|salon|framing|storefront)\b/.test(cat) || /walk-in|visit us|in person/.test(blob)) {
    return "local_physical";
  }
  if (/\b(virtual|remote|online)\b/.test(cat) || /\b(coach|consultant|consulting)\b/.test(cat)) {
    return "virtual_remote";
  }
  if (/\b(mobile|field)\b/.test(cat) || /we come to you|come to your/.test(blob)) {
    return "local_service_area";
  }
  return "hybrid";
}
__name(expertAccessKind, "expertAccessKind");
__name2(expertAccessKind, "expertAccessKind");
function expertCallHeavyBooking(fr) {
  const bm = fr?.booking_method?.value;
  if (requiresPublishedPhoneForExecution(bm)) return true;
  const s = cleanString4(bm).toLowerCase();
  return /\bcall\b|\bphone\b|phone call|quote by phone/.test(s);
}
__name(expertCallHeavyBooking, "expertCallHeavyBooking");
__name2(expertCallHeavyBooking, "expertCallHeavyBooking");
function collectBuyingFactorsFromPreflight(pi) {
  const p = isObject3(pi) ? pi : {};
  return uniqueList2([...cleanList3(p.buying_factors), ...cleanList3(p.buyer_factors)]).filter(Boolean);
}
__name(collectBuyingFactorsFromPreflight, "collectBuyingFactorsFromPreflight");
__name2(collectBuyingFactorsFromPreflight, "collectBuyingFactorsFromPreflight");
function buildEmailQuestionFromBuyerFactors(businessName, pi, blueprint) {
  const factors = collectBuyingFactorsFromPreflight(pi);
  if (!factors.length) return "";
  const name = cleanString4(businessName) || "your business";
  const bc = safeObject(blueprint?.strategy?.business_context);
  const category = cleanString4(bc.category);
  const personaHint = isObject3(pi) ? cleanString4(pi.target_persona_hint) : "";
  const basis = truncate2(factors.slice(0, 2).join("; "), 280);
  let opener = "";
  if (personaHint) {
    opener = `For the clients you do your best work with (${truncate2(personaHint, 100)}),`;
  } else if (category) {
    opener = `In ${truncate2(category, 72)} work,`;
  } else {
    opener = "When someone is comparing options and not ready to call yet,";
  }
  return `${opener} buyers often weigh: ${basis}. Email is where many first touchpoints happen\u2014what address should we publish for ${name} so those messages reach you reliably?`;
}
__name(buildEmailQuestionFromBuyerFactors, "buildEmailQuestionFromBuyerFactors");
__name2(buildEmailQuestionFromBuyerFactors, "buildEmailQuestionFromBuyerFactors");
function buildAccessExpertQuestion(primaryField, businessName, blueprint, pi) {
  const name = cleanString4(businessName) || "your business";
  const pf = cleanString4(primaryField);
  const fr = safeObject(blueprint?.fact_registry);
  const kind = expertAccessKind(blueprint, pi);
  const callHeavy = expertCallHeavyBooking(fr);
  if (pf === "phone") {
    const interp = buildInterpretation("phone", pi, blueprint, { callHeavy });
    return buildExpertMessage({
      lead: squeezeExpertLead([interp]),
      question: `What's the best number for customers to reach ${name}?`
    });
  }
  if (pf === "email") {
    const contextual = buildEmailQuestionFromBuyerFactors(name, pi, blueprint);
    if (contextual) return contextual;
    const interp = buildInterpretation("email", pi, blueprint);
    return buildExpertMessage({
      lead: squeezeExpertLead([interp]),
      question: `What email should we publish for ${name}?`
    });
  }
  if (pf === "address") {
    const interp = buildInterpretation("address", pi, blueprint, { accessKind: kind });
    return buildExpertMessage({
      lead: squeezeExpertLead([interp]),
      question: `What address or location should we show for ${name}?`
    });
  }
  if (pf === "hours") {
    const interp = buildInterpretation("hours", pi, blueprint);
    return buildExpertMessage({
      lead: squeezeExpertLead([interp]),
      question: `What hours or availability should people expect when they contact ${name}?`
    });
  }
  return "";
}
__name(buildAccessExpertQuestion, "buildAccessExpertQuestion");
__name2(buildAccessExpertQuestion, "buildAccessExpertQuestion");
function buildProcessExpertQuestion(businessName, blueprint, pi) {
  const p = isObject3(pi) ? pi : null;
  const wd = p ? cleanString4(p.website_direction) : "";
  const opp = p ? cleanString4(p.opportunity) : "";
  const pos = p ? cleanString4(p.positioning) : "";
  const interp = buildInterpretation("process_summary", pi, blueprint, { tangible: false });
  const guidance = opp || pos || "";
  const prefix = wd ? `For the site journey we're considering: ${wd}` : "";
  const consultative = isConsultativeExperienceHint(pi);
  const question = consultative ? "What happens when someone comes to you\u2014how do you guide them through the process?" : "Walk me through what happens when someone chooses you\u2014from first contact to finished result.";
  const leadParts = [interp];
  if (guidance) leadParts.push(guidance);
  if (prefix) leadParts.push(prefix);
  return buildExpertMessage({
    lead: squeezeExpertLead(leadParts),
    question
  });
}
__name(buildProcessExpertQuestion, "buildProcessExpertQuestion");
__name2(buildProcessExpertQuestion, "buildProcessExpertQuestion");
function buildProofExpertQuestion(primaryField, businessName, blueprint, pi) {
  const name = cleanString4(businessName) || "your business";
  const pf = cleanString4(primaryField);
  const p = isObject3(pi) ? pi : null;
  const weak = p ? cleanList3(p.weaknesses) : [];
  const buyers = p ? cleanList3(p.buyer_factors) : [];
  const opp = p ? cleanString4(p.opportunity) : "";
  const interp = buildInterpretation(pf, p, blueprint) || "";
  let bridge = "";
  if (opp) {
    bridge = opp;
  } else if (weak.length) {
    bridge = `Concretely, that often shows up as worrying about ${weak[0]}.`;
  } else if (buyers.length) {
    bridge = `They usually weigh ${buyers.slice(0, 2).join(" and ")} before saying yes.`;
  }
  const leadParts = [interp];
  if (bridge) leadParts.push(bridge);
  if (pf === "review_quotes") {
    return buildExpertMessage({
      lead: squeezeExpertLead(leadParts),
      question: "After working with you, what do customers usually say about the result\u2014or what language should we echo on the site?"
    });
  }
  if (pf === "trust_signal") {
    return buildExpertMessage({
      lead: squeezeExpertLead(leadParts),
      question: `What should we lean on most for ${name}\u2014reviews, outcomes, credentials, photos, or something else\u2014so that confidence lands quickly?`
    });
  }
  return "";
}
__name(buildProofExpertQuestion, "buildProofExpertQuestion");
__name2(buildProofExpertQuestion, "buildProofExpertQuestion");
function buildExpertContextualDeterministicQuestion(plan, blueprint, businessName, preflightIntelligence) {
  const name = cleanString4(businessName) || cleanString4(getByPath(blueprint, "business_draft.brand.name")) || "your business";
  const bundleId = cleanString4(plan?.bundle_id);
  const primaryField = cleanString4(plan?.primary_field);
  const pi = isObject3(preflightIntelligence) ? preflightIntelligence : null;
  if (bundleId === "contact_details") {
    const q = buildAccessExpertQuestion(primaryField, name, blueprint, pi);
    if (q) return q;
  }
  if (bundleId === "process" && primaryField === "process_summary") {
    return buildProcessExpertQuestion(name, blueprint, pi);
  }
  if (bundleId === "proof" && (primaryField === "review_quotes" || primaryField === "trust_signal")) {
    return buildProofExpertQuestion(primaryField, name, blueprint, pi);
  }
  return "";
}
__name(buildExpertContextualDeterministicQuestion, "buildExpertContextualDeterministicQuestion");
__name2(buildExpertContextualDeterministicQuestion, "buildExpertContextualDeterministicQuestion");
function userFacingDeterministicLead(bundleId, primaryField, pi) {
  if (!isObject3(pi)) return "";
  const b = cleanString4(bundleId);
  const pf = cleanString4(primaryField);
  const buyers = cleanList3(pi.buyer_factors);
  const weak = cleanList3(pi.weaknesses);
  const pos = cleanString4(pi.positioning);
  const opp = cleanString4(pi.opportunity);
  const angle = cleanString4(pi.winning_angle);
  const hyp = cleanString4(pi.differentiation_hypothesis);
  const alts = cleanList3(pi.local_alternatives);
  if (pf === "pricing") {
    const narrative = buildPricingPreflightNarrative(pi, { maxChars: 260, withPricingInstruction: false });
    if (narrative) return `${narrative} `;
  }
  if (pf === "target_persona" && angle) {
    return `You may show up strongest when positioned as: ${truncate2(angle, 200)} `;
  }
  if (pf === "differentiation" && hyp) {
    return `Here's a working differentiation angle to react to: ${truncate2(hyp, 220)} `;
  }
  if (pf === "primary_offer" && pos) {
    return `${truncate2(pos, 200)} `;
  }
  if ((pf === "review_quotes" || pf === "trust_signal") && weak.length) {
    return `Buyers in this space sometimes worry about: ${weak.slice(0, 3).join("; ")}. `;
  }
  if (pf === "comparison" && (alts.length || weak.length)) {
    const parts = [];
    if (alts.length) parts.push(`nearby alternatives include ${alts.slice(0, 2).join(", ")}`);
    if (weak.length) parts.push(`common concerns include ${weak.slice(0, 2).join("; ")}`);
    if (parts.length) return `${parts.join("; ")}. `;
  }
  if ((pf === "faq_angles" || b === "objection_handling") && buyers.length) {
    return `Before someone commits, they often weigh: ${buyers.slice(0, 4).join(", ")}. `;
  }
  if (pf === "process_summary" && cleanString4(pi.website_direction)) {
    return `For the site journey we're considering: ${truncate2(cleanString4(pi.website_direction), 180)} `;
  }
  return "";
}
__name(userFacingDeterministicLead, "userFacingDeterministicLead");
__name2(userFacingDeterministicLead, "userFacingDeterministicLead");
function formatFactValueForConfirmationPrompt(value) {
  if (value == null) return "";
  if (Array.isArray(value)) {
    const parts = value.map((v) => cleanString4(v)).filter(Boolean);
    return parts.length ? parts.join("; ") : "";
  }
  return cleanString4(value);
}
__name(formatFactValueForConfirmationPrompt, "formatFactValueForConfirmationPrompt");
__name2(formatFactValueForConfirmationPrompt, "formatFactValueForConfirmationPrompt");
function buildPrefilledUnverifiedConfirmationQuestion(plan, blueprint, preflightIntelligence) {
  const primaryField = cleanString4(plan?.primary_field);
  if (!primaryField) return "";
  if (primaryField === "primary_offer") return "";
  const fact = blueprint?.fact_registry?.[primaryField];
  if (!fact) return "";
  const factStatus = cleanString4(fact.status);
  const factConfidence = clampNumber(fact.confidence, 0, 1, 0);
  const isPrefilled = factStatus === "prefilled_unverified";
  const isLowConfidenceInferred = factStatus === "inferred" && factConfidence < INFERRED_FACT_COMPLETE_THRESHOLD;
  if (!isPrefilled && !isLowConfidenceInferred) return "";
  let insight = formatFactValueForConfirmationPrompt(fact.value);
  if (!hasMeaningfulValue2(insight) && isObject3(preflightIntelligence)) {
    const pi = preflightIntelligence;
    const fallbacks = {
      business_understanding: cleanString4(pi.positioning),
      opportunity: cleanString4(pi.opportunity),
      differentiation: cleanString4(pi.differentiation_hypothesis),
      trust_signal: cleanList3(pi.trust_markers)[0],
      aeo_angles: cleanString4(pi.winning_angle),
      recommended_focus: cleanList3(pi.recommended_focus).join("; "),
      website_direction: cleanString4(pi.website_direction)
    };
    insight = fallbacks[primaryField] || "";
  }
  if (!hasMeaningfulValue2(insight)) return "";
  return `I've noted this for ${primaryField.replace(/_/g, " ")}:

${truncate2(insight, 640)}

Is this correct, or would you adjust it?`;
}
__name(buildPrefilledUnverifiedConfirmationQuestion, "buildPrefilledUnverifiedConfirmationQuestion");
__name2(buildPrefilledUnverifiedConfirmationQuestion, "buildPrefilledUnverifiedConfirmationQuestion");
function narrativeAskCountForField(blueprint, primaryField) {
  const pf = cleanString4(primaryField);
  const history = Array.isArray(blueprint?.question_history) ? blueprint.question_history : [];
  let n = 0;
  for (const e of history) {
    if (cleanString4(e?.primary_field) === pf) n++;
  }
  return n;
}
__name(narrativeAskCountForField, "narrativeAskCountForField");
__name2(narrativeAskCountForField, "narrativeAskCountForField");
function getOfferStrength(offer) {
  const text = cleanString4(
    offer === null || offer === void 0 ? "" : typeof offer === "string" ? offer : stringifyFactValue(offer)
  ).toLowerCase();
  if (!text) return "missing";
  const words = text.split(/\s+/).filter(Boolean);
  const wc = words.length;
  const genericVerb = /\b(?:am|is|are|was|were|be|been|being|do|does|did|done|have|has|had|make|made|makes|take|took|takes|taken|give|gave|gives|given|get|got|gets|go|went|goes|gone|come|came|comes|put|puts|set|sets|run|ran|runs|see|saw|sees|know|knew|knows|find|found|finds|think|thought|thinks|say|said|says|tell|told|tells|ask|asked|asks|need|needed|needs|want|wanted|wants|use|used|uses|work|worked|works|try|tried|tries|call|called|calls|help|helped|helps|let|lets|show|showed|shown|shows|feel|felt|feels|leave|left|leaves|bring|brought|brings|keep|kept|keeps|begin|began|begins|seem|seemed|seems|include|included|includes|continue|continued|continues|provide|provided|provides|build|built|builds|create|created|creates|deliver|delivered|delivers|manage|managed|manages|handle|handled|handles|offer|offered|offers|support|supported|supports|pay|paid|pays|buy|bought|buys|meet|met|meets|send|sent|sends|sell|sold|sells|open|opened|opens|close|closed|closes|cut|cuts|install|installed|installs|ship|shipped|ships|train|trained|trains|teach|taught|teaches|cover|covered|covers)\b/.test(
    text
  );
  const outcomeLink = /\b(?:for|to|into|with|from|through|by)\s+[a-z0-9][a-z0-9'-]{2,}\b/.test(text) || /[,;]/.test(text) || /\s+and\s+/.test(text) && wc >= 6;
  if (genericVerb && outcomeLink && wc >= 6) return "usable";
  return "weak";
}
__name(getOfferStrength, "getOfferStrength");
__name2(getOfferStrength, "getOfferStrength");
function buildNarrativeDeterministicQuestion(plan, blueprint, preflightIntelligence) {
  const bundleId = cleanString4(plan?.bundle_id);
  const pf = cleanString4(plan?.primary_field);
  if (bundleId === "positioning" && pf === "target_persona") {
    const askN = narrativeAskCountForField(blueprint, "target_persona");
    if (askN >= 1) {
      return "In one short sentence, who is the main visitor you want this site to speak to?";
    }
    return "Who should feel this site was written for them \u2014 one sentence is enough.";
  }
  if (bundleId === "positioning" && pf === "primary_offer") {
    const offerFact = blueprint?.fact_registry?.primary_offer;
    const offerVal = stringifyFactValue(offerFact?.value);
    const strength = getOfferStrength(offerVal);
    const askN = narrativeAskCountForField(blueprint, "primary_offer");
    if (strength === "missing" || !hasMeaningfulValue2(offerVal)) {
      if (askN >= 1) {
        return "What are your most common services or types of work?";
      }
      return "What kinds of things do people usually hire you for? Give me a few real examples.";
    }
    if (strength === "weak") {
      return `We have a short starter line on what you offer. Which best matches how you think about it?

A) Mostly custom or repeat services
B) Mostly retail or walk-in offerings
C) A mix \u2014 both matter
D) Something else (say it in your own words)

Then add one concrete example of a job you're proud of.`;
    }
    const preview = truncate2(formatFactValueForConfirmationPrompt(offerFact?.value), 280);
    return `Your positioning draft says you offer: ${preview}

Is that accurate as the main story for what people hire you for \u2014 or what would you change?`;
  }
  if (bundleId === "objection_handling" && pf === "faq_angles") {
    const askN = narrativeAskCountForField(blueprint, "faq_angles");
    if (askN >= 1) {
      return "What concerns or questions do customers typically have before choosing you?";
    }
    return "What do people usually worry about or ask before they decide to work with you?";
  }
  return "";
}
__name(buildNarrativeDeterministicQuestion, "buildNarrativeDeterministicQuestion");
__name2(buildNarrativeDeterministicQuestion, "buildNarrativeDeterministicQuestion");
function buildDeterministicQuestionWithPreflight(plan, blueprint, businessName, preflightIntelligence) {
  const primaryField = cleanString4(plan?.primary_field);
  const follow = cleanString4(blueprint?.fact_registry?.[primaryField]?.intake_followup);
  if (follow) return follow;
  const prefillQ = buildPrefilledUnverifiedConfirmationQuestion(plan, blueprint, preflightIntelligence);
  if (prefillQ) return prefillQ;
  const bundleId = cleanString4(plan?.bundle_id);
  const pf = cleanString4(plan?.primary_field);
  if (bundleId === "contact_details" && ["phone", "address", "hours"].includes(pf)) {
    return "Where can people reach or visit you? You can include phone, address, and hours if available.";
  }
  const expert = buildExpertContextualDeterministicQuestion(plan, blueprint, businessName, preflightIntelligence);
  if (expert) return expert;
  const narrative = buildNarrativeDeterministicQuestion(plan, blueprint, preflightIntelligence);
  if (narrative) {
    const lead2 = userFacingDeterministicLead(
      cleanString4(plan?.bundle_id),
      cleanString4(plan?.primary_field),
      preflightIntelligence
    );
    return lead2 ? `${lead2}${narrative}` : narrative;
  }
  const base = buildDeterministicQuestion(plan, blueprint, businessName, preflightIntelligence);
  const lead = userFacingDeterministicLead(
    cleanString4(plan?.bundle_id),
    cleanString4(plan?.primary_field),
    preflightIntelligence
  );
  return lead ? `${lead}${base}` : base;
}
__name(buildDeterministicQuestionWithPreflight, "buildDeterministicQuestionWithPreflight");
__name2(buildDeterministicQuestionWithPreflight, "buildDeterministicQuestionWithPreflight");
function buildPreflightBridgeFraming(bundleId, primaryField, pi) {
  if (!isObject3(pi)) return "";
  const pf = cleanString4(primaryField);
  const b = cleanString4(bundleId);
  const angle = cleanString4(pi.winning_angle);
  const hyp = cleanString4(pi.differentiation_hypothesis);
  const pos = cleanString4(pi.positioning);
  const opp = cleanString4(pi.opportunity);
  const buyers = cleanList3(pi.buyer_factors);
  const weak = cleanList3(pi.weaknesses);
  const alts = cleanList3(pi.local_alternatives);
  const focus = cleanList3(pi.recommended_focus);
  if (pf === "target_persona" && angle) {
    return `Strategic note (validate, do not lecture): research suggests a strong fit when positioned as: ${truncate2(angle, 320)} Ask whether that matches who they usually serve best.`;
  }
  if (pf === "differentiation" && hyp) {
    return `Lead with this hypothesis in one clause: ${truncate2(hyp, 320)} Ask if they agree or how they'd sharpen it.`;
  }
  if (pf === "primary_offer" && pos) {
    return `Ground the question in this understanding: ${truncate2(pos, 280)}`;
  }
  if (pf === "booking_method" && opp) {
    return `Conversion context (stay on booking channel only; no pricing): ${truncate2(opp, 260)}`;
  }
  if (pf === "pricing") {
    const narrative = buildPricingPreflightNarrative(pi, { maxChars: 520, withPricingInstruction: true });
    if (narrative) return narrative;
  }
  if (b === "contact_details") {
    if (pf === "phone") {
      return `Why this matters: a clear public number should feel easy and trustworthy for how customers start. Rephrase warmly; stay on phone only\u2014no pricing or booking URLs.`;
    }
    if (pf === "email") {
      return `Why this matters: prospects should know where a serious inquiry goes. Rephrase naturally; stay on email only.`;
    }
    if (pf === "address") {
      return `Why this matters: location sets expectations for visits or service area. Rephrase clearly; stay on address only.`;
    }
    if (pf === "hours") {
      return `Why this matters: clear hours reduce friction and repeat questions. Rephrase helpfully; stay on hours only.`;
    }
  }
  if ((pf === "faq_angles" || b === "objection_handling") && buyers.length) {
    return `Buyers in this space often weigh: ${buyers.slice(0, 4).join("; ")}. Ask what objections or questions come up before someone books (stay on FAQ angle only).`;
  }
  if (pf === "review_quotes" || pf === "trust_signal") {
    if (opp) {
      return `Reflect real buyer hesitation or desire: ${truncate2(opp, 300)} Ask for concrete proof, quotes, or credibility lines that address that (trust topic only).`;
    }
    if (weak.length) {
      return `Where buyers tend to worry: ${weak.slice(0, 3).join("; ")}. Ask what they show or say that flips that worry (trust topic only).`;
    }
  }
  if (pf === "process_summary") {
    const wd = cleanString4(pi.website_direction);
    const parts = [];
    if (wd) parts.push(`Site direction: ${truncate2(wd, 220)}`);
    if (opp) parts.push(`Context: ${truncate2(opp, 260)}`);
    if (parts.length) {
      return `${parts.join(" \u2014 ")} Ask for the concrete steps a client experiences\u2014first touch through delivery (process topic only).`;
    }
    return `Ask for the real-world process from first contact through completion\u2014specific steps, not a generic promise (process topic only).`;
  }
  if (pf === "comparison" && (weak.length || alts.length || focus.length)) {
    const parts = [];
    if (alts.length) parts.push(`Alternatives buyers consider: ${alts.slice(0, 3).join("; ")}`);
    if (weak.length) parts.push(`Common gaps in those options: ${weak.slice(0, 3).join("; ")}`);
    if (focus.length) parts.push(`Strategic emphasis to test: ${focus.slice(0, 3).join("; ")}`);
    return `${parts.join(" ")} Ask how they want to be positioned versus those alternatives (comparison topic only).`;
  }
  return "";
}
__name(buildPreflightBridgeFraming, "buildPreflightBridgeFraming");
__name2(buildPreflightBridgeFraming, "buildPreflightBridgeFraming");
function violatesPrimaryFieldQuestionScope(message, primaryField) {
  const m = cleanString4(message).toLowerCase();
  const pf = cleanString4(primaryField);
  if (!m || !pf) return false;
  const mentionsPricing = /\b(pricing|price|priced|cost|fee|fees|rate|rates)\b/.test(m) || /\bhow much\b/.test(m) || /\b(pricing|price)\s+(or|and)\s+/.test(m);
  const mentionsAvailability = /\b(availability|available|time slots?|scheduling expectations)\b/.test(m) || /\banything\b[^?.]*\b(know|understand)\b[^?.]*\b(pricing|price|cost|availability)\b/.test(m);
  switch (pf) {
    case "booking_method":
      if (mentionsPricing) return true;
      if (mentionsAvailability) return true;
      return false;
    case "booking_url":
      if (mentionsPricing && !/\b(url|link|http|www\.|schedul|book online)\b/.test(m)) return true;
      return false;
    default:
      return false;
  }
}
__name(violatesPrimaryFieldQuestionScope, "violatesPrimaryFieldQuestionScope");
__name2(violatesPrimaryFieldQuestionScope, "violatesPrimaryFieldQuestionScope");
function listPreflightIntelligenceKeys(pi) {
  if (!isObject3(pi)) return [];
  return Object.keys(pi).filter((k) => {
    const v = pi[k];
    if (v == null) return false;
    if (k === "spec_version") return true;
    if (Array.isArray(v)) return v.length > 0;
    if (typeof v === "string") return v.trim().length > 0;
    if (typeof v === "boolean" || typeof v === "number") return true;
    if (isObject3(v)) return Object.keys(v).length > 0;
    return false;
  });
}
__name(listPreflightIntelligenceKeys, "listPreflightIntelligenceKeys");
__name2(listPreflightIntelligenceKeys, "listPreflightIntelligenceKeys");
function packQuestionRender(message, {
  fallback_triggered,
  llm_available,
  question_source,
  fallback_reason = null,
  preflight_bridge_framing = null,
  question_render_mode = null
}) {
  const out = {
    message: cleanString4(message),
    fallback_triggered: !!fallback_triggered,
    llm_available: !!llm_available,
    question_source: cleanString4(question_source) || "deterministic",
    fallback_reason: null,
    preflight_bridge_framing: cleanString4(preflight_bridge_framing) || null,
    question_render_mode: cleanString4(question_render_mode) || null
  };
  if (out.fallback_triggered) {
    out.fallback_reason = cleanString4(fallback_reason) || null;
  }
  return out;
}
__name(packQuestionRender, "packQuestionRender");
__name2(packQuestionRender, "packQuestionRender");
function classifyQuestionRenderFetchError(err) {
  const name = cleanString4(err?.name);
  const msg = cleanString4(err?.message).toLowerCase();
  const code = err?.cause?.code || err?.code;
  if (name === "AbortError" || code === "ETIMEDOUT" || /timeout|timed out/i.test(msg)) {
    return "timeout";
  }
  return "api_error";
}
__name(classifyQuestionRenderFetchError, "classifyQuestionRenderFetchError");
__name2(classifyQuestionRenderFetchError, "classifyQuestionRenderFetchError");
function getRephraseForbiddenLine(primaryField) {
  const pf = cleanString4(primaryField);
  switch (pf) {
    case "booking_method":
      return "Do NOT mention pricing, cost, fees, rates, how much you charge, quotes as money, or availability / time slots (except scheduling channel words like \u201Cbook online\u201D if already in base_question).";
    case "booking_url":
      return "Do NOT mention pricing, cost, fees, or how much.";
    case "contact_path":
      return "Do NOT mention pricing, package tiers, or booking URLs unless base_question already does.";
    case "pricing":
      return "Do NOT ask how someone books, scheduling links, or phone vs form as a second thread\u2014only pricing/quoting mechanics.";
    default:
      return "Do not introduce topics outside what base_question already asks.";
  }
}
__name(getRephraseForbiddenLine, "getRephraseForbiddenLine");
__name2(getRephraseForbiddenLine, "getRephraseForbiddenLine");
async function polishIntakeQuestionRephraseOnly({
  env,
  baseQuestion,
  primaryField,
  bundleId,
  businessName
}) {
  const base = cleanString4(baseQuestion);
  const pf = cleanString4(primaryField);
  if (!base || !env?.OPENAI_API_KEY) return null;
  const payload = {
    model: env.OPENAI_MODEL || DEFAULT_OPENAI_MODEL,
    temperature: 0.12,
    max_tokens: 200,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: [
          "You polish a single intake question for SiteForge Factory.",
          "Input includes base_question. It is already correct and single-topic.",
          "Rewrite in a consultative, premium tone with MINIMAL change to meaning and scope.",
          "Hard rules:",
          "1) Output exactly ONE question: one or two short sentences, max 65 words total.",
          "2) Do NOT add examples, dimensions, or follow-up topics that base_question does not already imply.",
          "3) " + getRephraseForbiddenLine(pf),
          "4) Do not mention schema, JSON, fields, or internal labels.",
          '5) Return JSON only: { "message": "..." }'
        ].join("\n")
      },
      {
        role: "user",
        content: JSON.stringify(
          {
            business_name: cleanString4(businessName),
            primary_field: pf,
            bundle_id: cleanString4(bundleId),
            base_question: base
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
  if (!response.ok) {
    const errBody = await response.text();
    throw new Error(`polish question ${response.status}: ${errBody.slice(0, 200)}`);
  }
  const data = await response.json();
  const raw = data?.choices?.[0]?.message?.content;
  const parsed = safeJsonParse(raw);
  const message = cleanString4(parsed?.message);
  return message || null;
}
__name(polishIntakeQuestionRephraseOnly, "polishIntakeQuestionRephraseOnly");
__name2(polishIntakeQuestionRephraseOnly, "polishIntakeQuestionRephraseOnly");
async function renderNextQuestion({
  env,
  blueprint,
  previousPlan,
  interpretation,
  businessName,
  preflightIntelligence
}) {
  const llmConfigured = !!env?.OPENAI_API_KEY;
  const plan = blueprint.question_plan;
  const hasPlan = isObject3(plan) && (hasMeaningfulValue2(plan.primary_field) || cleanList3(plan.target_fields).length > 0 || hasMeaningfulValue2(plan.bundle_id));
  if (!hasPlan) {
    return packQuestionRender("Excellent \u2014 we now have enough verified clarity to move into final assembly.", {
      fallback_triggered: false,
      llm_available: llmConfigured,
      question_source: "complete",
      fallback_reason: null,
      question_render_mode: null
    });
  }
  const factRegistry = isObject3(blueprint?.fact_registry) ? blueprint.fact_registry : {};
  const planTargetFields = Array.isArray(plan.target_fields) ? plan.target_fields : [];
  const isFieldResolvedLocal = /* @__PURE__ */ __name2((fieldKey) => isFactResolved(factRegistry?.[fieldKey], fieldKey), "isFieldResolvedLocal");
  let adjustedPlan = { ...plan };
  if (cleanString4(plan.primary_field) && isFieldResolvedLocal(plan.primary_field)) {
    const nextUnresolvedField = planTargetFields.find((fieldKey) => !isFieldResolvedLocal(fieldKey));
    if (nextUnresolvedField) {
      adjustedPlan.primary_field = nextUnresolvedField;
    }
  }
  const fallback = buildDeterministicQuestionWithPreflight(
    adjustedPlan,
    blueprint,
    businessName,
    preflightIntelligence
  );
  const bridgeFraming = buildPreflightBridgeFraming(
    cleanString4(adjustedPlan.bundle_id),
    cleanString4(adjustedPlan.primary_field),
    preflightIntelligence
  );
  const bridgeMeta = {
    preflight_bridge_framing: bridgeFraming || null,
    question_render_mode: "rephrase_only"
  };
  if (!llmConfigured) {
    return packQuestionRender(appendFollowupHintToQuestion(blueprint, fallback), {
      fallback_triggered: false,
      llm_available: false,
      question_source: "deterministic",
      fallback_reason: null,
      preflight_bridge_framing: bridgeMeta.preflight_bridge_framing,
      question_render_mode: "deterministic_only"
    });
  }
  try {
    const message = await polishIntakeQuestionRephraseOnly({
      env,
      baseQuestion: fallback,
      primaryField: cleanString4(adjustedPlan.primary_field),
      bundleId: cleanString4(adjustedPlan.bundle_id),
      businessName
    });
    if (!message) {
      return packQuestionRender(appendFollowupHintToQuestion(blueprint, fallback), {
        fallback_triggered: true,
        llm_available: true,
        question_source: "deterministic",
        fallback_reason: "empty_response",
        ...bridgeMeta
      });
    }
    if (isOverloadedQuestion(message, adjustedPlan.bundle_id)) {
      return packQuestionRender(appendFollowupHintToQuestion(blueprint, fallback), {
        fallback_triggered: true,
        llm_available: true,
        question_source: "deterministic",
        fallback_reason: "scope_violation",
        ...bridgeMeta
      });
    }
    if (looksLikeRepeatedQuestion(message, interpretation?.answer_summary, adjustedPlan.bundle_id)) {
      return packQuestionRender(appendFollowupHintToQuestion(blueprint, fallback), {
        fallback_triggered: true,
        llm_available: true,
        question_source: "deterministic",
        fallback_reason: "repetition",
        ...bridgeMeta
      });
    }
    if (violatesPrimaryFieldQuestionScope(message, cleanString4(adjustedPlan.primary_field))) {
      return packQuestionRender(appendFollowupHintToQuestion(blueprint, fallback), {
        fallback_triggered: true,
        llm_available: true,
        question_source: "deterministic",
        fallback_reason: "scope_violation",
        ...bridgeMeta
      });
    }
    return packQuestionRender(appendFollowupHintToQuestion(blueprint, message), {
      fallback_triggered: false,
      llm_available: true,
      question_source: "llm",
      fallback_reason: null,
      ...bridgeMeta
    });
  } catch (err) {
    console.error("[intake-next-v2-1:render-question]", err);
    return packQuestionRender(appendFollowupHintToQuestion(blueprint, fallback), {
      fallback_triggered: true,
      llm_available: true,
      question_source: "deterministic",
      fallback_reason: classifyQuestionRenderFetchError(err),
      ...bridgeMeta
    });
  }
}
__name(renderNextQuestion, "renderNextQuestion");
__name2(renderNextQuestion, "renderNextQuestion");
function buildDeterministicQuestion(plan, blueprint, businessName, preflightIntelligence) {
  const name = cleanString4(businessName) || cleanString4(getByPath(blueprint, "business_draft.brand.name")) || "your business";
  const bundleId = cleanString4(plan?.bundle_id);
  const primaryField = cleanString4(plan?.primary_field);
  if (bundleId === "conversion") {
    switch (primaryField) {
      case "pricing":
        return `When someone requests a quote from ${name}, how do you typically price the work \u2014 is it based on scope, size, complexity, or something else?`;
      case "booking_url":
        return `After someone requests a quote from ${name}, do you send them to a booking page or scheduling link, or is everything handled manually?`;
      case "booking_method":
        return `When someone is ready to move forward with ${name}, how do they typically take the next step \u2014 do they call, request a quote, use a form, book online, or something else?`;
      case "contact_path":
        return `What is the preferred path for a serious prospect to contact ${name} \u2014 form, phone call, text, email, or something else?`;
      default:
        return `What is the single next detail about how ${name} converts interest into action that we should capture?`;
    }
  }
  if (bundleId === "positioning") {
    switch (primaryField) {
      case "target_persona":
        return `Who is this site mainly for \u2014 one sentence is enough.`;
      case "primary_offer":
        return `What kinds of things do people usually hire you for? Give me a few real examples.`;
      case "differentiation":
        return `What makes ${name} meaningfully different from the other options someone might be comparing you against?`;
      case "gallery_visual_direction":
      case "hero_image_query":
        return `What should the visuals for ${name} make someone feel immediately, and what kinds of scenes or details best represent the work?`;
      default:
        return `If a strong-fit visitor lands on ${name}, what should they immediately understand about who it is for, what you offer, and what makes it different?`;
    }
  }
  if (bundleId === "service_area") {
    switch (primaryField) {
      case "surrounding_cities":
        return `Besides your main area, which nearby cities, neighborhoods, or regions should we represent for ${name}?`;
      case "service_area_main":
        return `What is the primary city or market ${name} should be centered around on the site?`;
      default:
        return `What is the primary market you want this site to speak to, and are there nearby cities or regions you also want represented?`;
    }
  }
  if (bundleId === "proof") {
    switch (primaryField) {
      case "review_quotes":
        return `What kinds of things do clients consistently say after working with ${name}, or do you have any review language we should reflect?`;
      case "years_experience":
        return `How long have you been doing this work, and how should that experience come through on the site?`;
      case "trust_signal":
        return `What are the strongest trust signals we can lean on for ${name} \u2014 experience, reviews, outcomes, photos, reputation, or something else?`;
      default:
        return `What are the strongest proof points we can use to help someone trust ${name} quickly?`;
    }
  }
  if (bundleId === "process") {
    return `Walk me through what happens when someone chooses you\u2014from first contact to finished result.`;
  }
  if (bundleId === "gallery_strategy") {
    switch (primaryField) {
      case "gallery_visual_direction":
        return `What kinds of scenes, details, or outcomes should the gallery for ${name} emphasize so the site feels like the right fit?`;
      case "hero_image_query":
        return `What should the hero image for ${name} communicate at a glance \u2014 the type of work, the setting, the customer, or the result?`;
      default:
        return `What visual direction should the site for ${name} take so it feels premium and true to the business?`;
    }
  }
  if (bundleId === "pricing_model") {
    return `Do you offer standardized packages or tiers, or is pricing usually customized from quote to quote?`;
  }
  if (bundleId === "objection_handling") {
    return `What do people usually worry about or ask before they decide to work with you?`;
  }
  if (bundleId === "story") {
    return `What is the story behind ${name}, and what standards, philosophy, or perspective should come through in the about section?`;
  }
  if (bundleId === "events_strategy") {
    return `Do you have recurring sessions, classes, tours, or any other time-based offerings we should show on the site?`;
  }
  if (bundleId === "comparison_strategy") {
    return `What alternatives are buyers usually comparing ${name} against, and what tends to make them choose you?`;
  }
  if (bundleId === "contact_details") {
    switch (primaryField) {
      case "phone":
        return `What is the best public phone number to show for ${name}?`;
      case "email": {
        const custom = buildEmailQuestionFromBuyerFactors(
          name,
          isObject3(preflightIntelligence) ? preflightIntelligence : null,
          blueprint
        );
        if (custom) return custom;
        return `What email address should serious prospects use to reach ${name}?`;
      }
      case "address":
        return `What address should we show publicly for ${name}, if any?`;
      case "hours":
        return `What hours or availability should people expect when contacting ${name}?`;
      default:
        return `What contact details should we treat as the accurate public version for the site?`;
    }
  }
  return `What is the next important thing a serious prospect should understand about ${name} before deciding to contact or book?`;
}
__name(buildDeterministicQuestion, "buildDeterministicQuestion");
__name2(buildDeterministicQuestion, "buildDeterministicQuestion");
function syncCompatibilityMirrors(state) {
  const blueprint = normalizeBlueprint(state.blueprint);
  const factRegistry = blueprint.fact_registry;
  state.answers = isObject3(state.answers) ? state.answers : {};
  state.verified = isObject3(state.verified) ? state.verified : {};
  state.meta = isObject3(state.meta) ? state.meta : {};
  state.meta.verified = isObject3(state.meta.verified) ? state.meta.verified : {};
  state.meta.inferred = isObject3(state.meta.inferred) ? state.meta.inferred : {};
  state.verification = isObject3(state.verification) ? state.verification : {};
  for (const [key, fact] of Object.entries(factRegistry)) {
    state.answers[key] = deepClone(fact.value);
    state.verified[key] = !!fact.verified;
    state.meta.verified[key] = !!fact.verified;
    if (cleanString4(fact.source) === "inferred") {
      state.meta.inferred[key] = true;
    }
  }
  state.verification = {
    queue_complete: blueprint.verification_queue.length === 0,
    verified_count: Object.values(factRegistry).filter((fact) => !!fact?.verified).length,
    remaining_keys: blueprint.verification_queue.map((item) => cleanString4(item.field_key)).filter(Boolean),
    last_updated: (/* @__PURE__ */ new Date()).toISOString()
  };
  state.current_key = cleanString4(blueprint.question_plan?.primary_field);
}
__name(syncCompatibilityMirrors, "syncCompatibilityMirrors");
__name2(syncCompatibilityMirrors, "syncCompatibilityMirrors");
function normalizeState2(state) {
  const next = isObject3(state) ? state : {};
  next.slug = cleanString4(next.slug);
  next.businessName = cleanString4(next.businessName);
  next.clientEmail = cleanString4(next.clientEmail);
  next.phase = cleanString4(next.phase) || "blueprint_verify";
  next.action = cleanString4(next.action);
  next.answers = isObject3(next.answers) ? next.answers : {};
  next.ghostwritten = isObject3(next.ghostwritten) ? next.ghostwritten : {};
  next.verified = isObject3(next.verified) ? next.verified : {};
  next.conversation = Array.isArray(next.conversation) ? next.conversation : [];
  next.meta = isObject3(next.meta) ? next.meta : {};
  next.meta.seeded = isObject3(next.meta.seeded) ? next.meta.seeded : {};
  next.meta.inferred = isObject3(next.meta.inferred) ? next.meta.inferred : {};
  next.meta.verified = isObject3(next.meta.verified) ? next.meta.verified : {};
  next.provenance = isObject3(next.provenance) ? next.provenance : {};
  next.verification = isObject3(next.verification) ? next.verification : {};
  next.blueprint = normalizeBlueprint(next.blueprint);
  next.readiness = isObject3(next.readiness) ? next.readiness : {};
  next.turn_debug = isObject3(next.turn_debug) ? next.turn_debug : {};
  next.preflight_intelligence = isObject3(next.preflight_intelligence) ? next.preflight_intelligence : {};
  next.reinforcement = isObject3(next.reinforcement) ? next.reinforcement : null;
  if (next.meta) {
    next.meta.last_turn_reinforcement_source = cleanString4(next.meta.last_turn_reinforcement_source) || null;
  }
  return next;
}
__name(normalizeState2, "normalizeState2");
__name2(normalizeState2, "normalizeState");
function normalizeBlueprint(blueprint) {
  const next = isObject3(blueprint) ? blueprint : {};
  next.strategy = isObject3(next.strategy) ? next.strategy : {};
  next.fact_registry = normalizeFactRegistry(next.fact_registry);
  next.business_draft = isObject3(next.business_draft) ? next.business_draft : {};
  next.section_status = isObject3(next.section_status) ? next.section_status : {};
  next.verification_queue = Array.isArray(next.verification_queue) ? next.verification_queue : [];
  next.question_candidates = Array.isArray(next.question_candidates) ? next.question_candidates : [];
  next.question_plan = isObject3(next.question_plan) ? next.question_plan : null;
  next.component_states = isObject3(next.component_states) ? next.component_states : {};
  next.decision_states = isObject3(next.decision_states) ? next.decision_states : {};
  next.premium_readiness = isObject3(next.premium_readiness) ? next.premium_readiness : null;
  next.access_readiness = isObject3(next.access_readiness) ? next.access_readiness : null;
  next.evidence_log = Array.isArray(next.evidence_log) ? next.evidence_log : [];
  next.question_history = Array.isArray(next.question_history) ? next.question_history : [];
  return next;
}
__name(normalizeBlueprint, "normalizeBlueprint");
__name2(normalizeBlueprint, "normalizeBlueprint");
function normalizeFactRegistry(input) {
  const registry = isObject3(input) ? input : {};
  const out = {};
  for (const [key, entry] of Object.entries(registry)) {
    if (isObject3(entry) && Object.prototype.hasOwnProperty.call(entry, "value")) {
      let val = sanitizeFactValue(normalizeModelValue(entry.value));
      let status = sanitizeFactStatus(entry.status || inferFactStatus(val));
      let verified = !!entry.verified;
      if (!hasMeaningfulValue2(val)) {
        if (status === "answered" || status === "inferred" || status === "partial") {
          status = inferFactStatus(val);
          verified = false;
        }
        if (status === "prefilled_unverified") {
          status = "missing";
          verified = false;
        }
      }
      out[key] = {
        ...entry,
        value: val,
        source: cleanString4(entry.source) || "unknown",
        confidence: clampNumber(entry.confidence, 0, 1, 0),
        verified,
        status,
        rationale: cleanString4(entry.rationale),
        history: Array.isArray(entry.history) ? entry.history : []
      };
    } else {
      let val = sanitizeFactValue(normalizeModelValue(entry));
      const status = sanitizeFactStatus(inferFactStatus(val));
      out[key] = {
        value: val,
        source: "unknown",
        confidence: hasMeaningfulValue2(val) ? 0.5 : 0,
        verified: false,
        status,
        rationale: "",
        history: []
      };
    }
  }
  return out;
}
__name(normalizeFactRegistry, "normalizeFactRegistry");
__name2(normalizeFactRegistry, "normalizeFactRegistry");
function buildCompletionMessage(businessName, readiness) {
  const name = cleanString4(businessName) || "your business";
  const score = clampNumber(readiness?.score, 0, 1, 1);
  const percentage = Math.round(score * 100);
  return `Excellent \u2014 we now have enough verified clarity for ${name}. Intake is complete (${percentage}% readiness), and we can move into final assembly.`;
}
__name(buildCompletionMessage, "buildCompletionMessage");
__name2(buildCompletionMessage, "buildCompletionMessage");
async function readJson2(request) {
  const raw = await request.text();
  try {
    return JSON.parse(raw || "{}");
  } catch {
    throw new Error("Invalid JSON payload");
  }
}
__name(readJson2, "readJson2");
__name2(readJson2, "readJson");
function json3(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store"
    }
  });
}
__name(json3, "json3");
__name2(json3, "json");
function cleanString4(value) {
  return typeof value === "string" ? value.trim() : "";
}
__name(cleanString4, "cleanString4");
__name2(cleanString4, "cleanString");
function cleanList3(value) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => cleanString4(item)).filter(Boolean);
}
__name(cleanList3, "cleanList3");
__name2(cleanList3, "cleanList");
function normalizeStringArray(value) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => cleanString4(item)).filter(Boolean);
}
__name(normalizeStringArray, "normalizeStringArray");
__name2(normalizeStringArray, "normalizeStringArray");
function isObject3(value) {
  return !!value && typeof value === "object" && !Array.isArray(value);
}
__name(isObject3, "isObject3");
__name2(isObject3, "isObject");
function hasMeaningfulValue2(value) {
  if (Array.isArray(value)) return value.some((item) => hasMeaningfulValue2(item));
  if (isObject3(value)) return Object.values(value).some((item) => hasMeaningfulValue2(item));
  if (typeof value === "boolean") return true;
  if (typeof value === "number") return true;
  return cleanString4(value) !== "";
}
__name(hasMeaningfulValue2, "hasMeaningfulValue2");
__name2(hasMeaningfulValue2, "hasMeaningfulValue");
function sanitizeFactValue(value) {
  if (value == null) return value;
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeFactValue(item));
  }
  if (!isObject3(value)) return value;
  if ("value" in value && ("status" in value || "source" in value)) {
    return sanitizeFactValue(value.value);
  }
  if ("status" in value && "source" in value) {
    return null;
  }
  if ("status" in value) {
    const metaKeys = /* @__PURE__ */ new Set([
      "status",
      "confidence",
      "verified",
      "rationale",
      "source",
      "updated_at",
      "requires_client_verification"
    ]);
    if (Object.keys(value).every((k) => metaKeys.has(k))) {
      return null;
    }
  }
  return value;
}
__name(sanitizeFactValue, "sanitizeFactValue");
__name2(sanitizeFactValue, "sanitizeFactValue");
function isBookingUrlNoLinkSentinel(value) {
  const s = cleanString4(value).toLowerCase();
  return s === "manual" || s === "manually" || s === "none" || s === "n/a" || s === "na" || s === "manual_followup";
}
__name(isBookingUrlNoLinkSentinel, "isBookingUrlNoLinkSentinel");
__name2(isBookingUrlNoLinkSentinel, "isBookingUrlNoLinkSentinel");
function isBookingUrlResolved(fact) {
  if (!fact) return false;
  const st = cleanString4(fact.status);
  const confidence = typeof fact.confidence === "number" ? fact.confidence : 0;
  const statusOk = st === "answered" || st === "verified" || st === "partial" || fact.verified === true || st === "inferred" && confidence >= INFERRED_FACT_COMPLETE_THRESHOLD;
  if (!statusOk) return false;
  const raw = sanitizeFactValue(fact.value);
  if (raw == null) return true;
  if (typeof raw !== "string") return false;
  const value = cleanString4(raw).toLowerCase();
  if (isBookingUrlNoLinkSentinel(raw)) return true;
  return value.startsWith("http://") || value.startsWith("https://");
}
__name(isBookingUrlResolved, "isBookingUrlResolved");
__name2(isBookingUrlResolved, "isBookingUrlResolved");
function bookingUrlValueForDraftLink(raw) {
  if (!hasMeaningfulValue2(raw) || typeof raw !== "string") return "";
  if (isBookingUrlNoLinkSentinel(raw)) return "";
  return isPlausibleBookingUrlString(raw) ? raw.trim() : "";
}
__name(bookingUrlValueForDraftLink, "bookingUrlValueForDraftLink");
__name2(bookingUrlValueForDraftLink, "bookingUrlValueForDraftLink");
function sanitizeFactStatus(value) {
  const status = cleanString4(value);
  if (status === "partial") return "partial";
  if (status === "inferred") return "inferred";
  if (status === "answered") return "answered";
  if (status === "missing") return "missing";
  if (status === "prefilled_unverified") return "prefilled_unverified";
  if (status === "seeded") return "seeded";
  return "answered";
}
__name(sanitizeFactStatus, "sanitizeFactStatus");
__name2(sanitizeFactStatus, "sanitizeFactStatus");
function inferFactStatus(value) {
  return hasMeaningfulValue2(value) ? "answered" : "missing";
}
__name(inferFactStatus, "inferFactStatus");
__name2(inferFactStatus, "inferFactStatus");
function clampNumber(value, min, max, fallback) {
  const num = Number(value);
  if (Number.isNaN(num)) return fallback;
  return Math.min(max, Math.max(min, num));
}
__name(clampNumber, "clampNumber");
__name2(clampNumber, "clampNumber");
function safeObject(value) {
  return isObject3(value) ? value : {};
}
__name(safeObject, "safeObject");
__name2(safeObject, "safeObject");
function safeJsonParse(value) {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}
__name(safeJsonParse, "safeJsonParse");
__name2(safeJsonParse, "safeJsonParse");
function uniqueList2(values) {
  return Array.from(new Set((Array.isArray(values) ? values : []).map((item) => cleanString4(item)).filter(Boolean)));
}
__name(uniqueList2, "uniqueList2");
__name2(uniqueList2, "uniqueList");
function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}
__name(deepClone, "deepClone");
__name2(deepClone, "deepClone");
function dedupeBy(items, key) {
  const map = /* @__PURE__ */ new Map();
  for (const item of Array.isArray(items) ? items : []) {
    map.set(item[key], item);
  }
  return Array.from(map.values());
}
__name(dedupeBy, "dedupeBy");
__name2(dedupeBy, "dedupeBy");
function truncate2(text, maxLength) {
  const value = cleanString4(text);
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength - 1)}\u2026`;
}
__name(truncate2, "truncate2");
__name2(truncate2, "truncate");
function firstNonEmpty2(values) {
  for (const value of Array.isArray(values) ? values : []) {
    if (hasMeaningfulValue2(value)) return value;
  }
  return "";
}
__name(firstNonEmpty2, "firstNonEmpty2");
__name2(firstNonEmpty2, "firstNonEmpty");
function firstArrayItem(value) {
  if (Array.isArray(value) && value.length) return value[0];
  return "";
}
__name(firstArrayItem, "firstArrayItem");
__name2(firstArrayItem, "firstArrayItem");
function firstNonEmptyArray(values) {
  for (const value of Array.isArray(values) ? values : []) {
    if (Array.isArray(value) && value.length) return value;
  }
  return [];
}
__name(firstNonEmptyArray, "firstNonEmptyArray");
__name2(firstNonEmptyArray, "firstNonEmptyArray");
function collectLeafPaths(obj, base = "") {
  if (Array.isArray(obj)) {
    if (!obj.length && base) return [base];
    let out2 = [];
    obj.forEach((item, index) => {
      const child = base ? `${base}.${index}` : String(index);
      out2 = out2.concat(collectLeafPaths(item, child));
    });
    return out2;
  }
  if (!isObject3(obj)) {
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
__name(collectLeafPaths, "collectLeafPaths");
__name2(collectLeafPaths, "collectLeafPaths");
function getByPath(obj, path) {
  const parts = cleanString4(path).split(".").filter(Boolean);
  let current = obj;
  for (const part of parts) {
    if (!isObject3(current) && !Array.isArray(current)) return void 0;
    current = current?.[part];
  }
  return current;
}
__name(getByPath, "getByPath");
__name2(getByPath, "getByPath");
function setByPath(obj, path, value) {
  const parts = cleanString4(path).split(".").filter(Boolean);
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
    if (!isObject3(current[part]) && !Array.isArray(current[part])) {
      current[part] = nextIsIndex ? [] : {};
    }
    current = current[part];
  }
}
__name(setByPath, "setByPath");
__name2(setByPath, "setByPath");
function hasPath(obj, path) {
  return typeof getByPath(obj, path) !== "undefined";
}
__name(hasPath, "hasPath");
__name2(hasPath, "hasPath");
function safeAssignPathIfExists(obj, path, value) {
  if (!hasMeaningfulValue2(value)) return;
  if (!hasPath(obj, path)) return;
  setByPath(obj, path, deepClone(value));
}
__name(safeAssignPathIfExists, "safeAssignPathIfExists");
__name2(safeAssignPathIfExists, "safeAssignPathIfExists");
function isAllowedDraftPatch(item, allowedTopLevelSections, allowedLeafPaths) {
  if (!isObject3(item)) return false;
  const section = cleanString4(item.section);
  const path = cleanString4(item.path);
  if (!section || !path) return false;
  if (!allowedTopLevelSections.includes(section)) return false;
  if (path.includes("__proto__") || path.includes("constructor") || path.includes("prototype")) return false;
  if (allowedLeafPaths.includes(path)) return true;
  return path === section || path.startsWith(`${section}.`);
}
__name(isAllowedDraftPatch, "isAllowedDraftPatch");
__name2(isAllowedDraftPatch, "isAllowedDraftPatch");
function pruneFactRegistryForModel(factRegistry) {
  const out = {};
  for (const [key, value] of Object.entries(factRegistry || {})) {
    out[key] = {
      value: value?.value,
      verified: !!value?.verified,
      status: cleanString4(value?.status),
      confidence: Number(value?.confidence || 0)
    };
  }
  return out;
}
__name(pruneFactRegistryForModel, "pruneFactRegistryForModel");
__name2(pruneFactRegistryForModel, "pruneFactRegistryForModel");
function normalizeModelValue(value) {
  if (Array.isArray(value)) return value.map((item) => normalizeModelValue(item));
  if (isObject3(value)) {
    const out = {};
    for (const [key, item] of Object.entries(value)) out[key] = normalizeModelValue(item);
    return out;
  }
  if (typeof value === "string") return value.trim();
  return value;
}
__name(normalizeModelValue, "normalizeModelValue");
__name2(normalizeModelValue, "normalizeModelValue");
function ensureArrayStrings(value) {
  if (Array.isArray(value)) return value.map((item) => cleanString4(item)).filter(Boolean);
  if (cleanString4(value)) return [cleanString4(value)];
  return [];
}
__name(ensureArrayStrings, "ensureArrayStrings");
__name2(ensureArrayStrings, "ensureArrayStrings");
function stringifyFactValue(value) {
  if (typeof value === "number") return String(value);
  return cleanString4(value);
}
__name(stringifyFactValue, "stringifyFactValue");
__name2(stringifyFactValue, "stringifyFactValue");
function isFactResolved(fact, fieldKey = "") {
  if (!fact) return false;
  if (hasMeaningfulValue2(fact.intake_followup)) return false;
  if (cleanString4(fieldKey) === "booking_url" && isBookingUrlResolved(fact)) {
    return true;
  }
  if (cleanString4(fieldKey) === "primary_offer") {
    const st = cleanString4(fact.status);
    const vOffer = sanitizeFactValue(fact.value);
    if (!hasMeaningfulValue2(vOffer)) return false;
    return st === "answered" || st === "verified";
  }
  const v = sanitizeFactValue(fact.value);
  if (!hasMeaningfulValue2(v)) return false;
  const status = cleanString4(fact.status);
  const confidence = typeof fact.confidence === "number" ? fact.confidence : 0;
  if (fieldKey === "target_persona") {
    if (status === "prefilled_unverified" || status === "seeded") return true;
    if (cleanString4(fact.source) === "preflight") return true;
  }
  if (status === "prefilled_unverified") return false;
  return status === "verified" || status === "answered" || status === "inferred" && confidence >= INFERRED_FACT_COMPLETE_THRESHOLD;
}
__name(isFactResolved, "isFactResolved");
__name2(isFactResolved, "isFactResolved");
function shouldApplyCopyRefinement(existing, nextValue, confidence) {
  if (!hasMeaningfulValue2(nextValue)) return false;
  if (typeof nextValue !== "string") return true;
  if (!hasMeaningfulValue2(existing)) return true;
  return confidence >= 0.6;
}
__name(shouldApplyCopyRefinement, "shouldApplyCopyRefinement");
__name2(shouldApplyCopyRefinement, "shouldApplyCopyRefinement");
function inferDecisionForFact(key) {
  const map = {
    primary_offer: "positioning",
    target_persona: "positioning",
    differentiation: "positioning",
    hero_image_query: "gallery_strategy",
    gallery_visual_direction: "gallery_strategy",
    booking_method: "conversion",
    pricing: "conversion",
    booking_url: "conversion",
    contact_path: "conversion",
    review_quotes: "proof",
    trust_signal: "proof",
    years_experience: "proof",
    process_summary: "process",
    service_area_main: "service_area",
    surrounding_cities: "service_area",
    faq_angles: "objection_handling",
    founder_story: "story",
    phone: "contact_details",
    email: "contact_details",
    address: "contact_details",
    hours: "contact_details",
    comparison: "comparison_strategy",
    events: "events_strategy",
    investment: "pricing_model"
  };
  return map[key] || "positioning";
}
__name(inferDecisionForFact, "inferDecisionForFact");
__name2(inferDecisionForFact, "inferDecisionForFact");
function inferVerificationReasonForFact(key) {
  const reasons = {
    pricing: "Pricing context helps the site set expectations.",
    booking_url: "Booking URL determines whether CTA can send visitors externally.",
    review_quotes: "Reviews make the site feel credible quickly.",
    process_summary: "Process clarity can reduce friction and improve trust.",
    gallery_visual_direction: "Visual strategy improves hero and gallery quality.",
    phone: "Phone should be accurate for publish-readiness.",
    email: "Email should be accurate for contact routing.",
    address: "Address may be needed for publish-readiness.",
    hours: "Hours clarify availability and publish-readiness."
  };
  return reasons[key] || "This fact still needs verification or refinement.";
}
__name(inferVerificationReasonForFact, "inferVerificationReasonForFact");
__name2(inferVerificationReasonForFact, "inferVerificationReasonForFact");
function getDecisionTargets() {
  return {
    conversion: {
      components: ["hero", "contact"],
      target_fields: ["booking_method", "pricing", "booking_url", "contact_path"],
      base_priority: 240,
      intent: "Clarify how visitors move from interest to action, including booking flow and pricing expectations.",
      reason: "This defines how the site converts visitors."
    },
    positioning: {
      components: ["hero", "features"],
      target_fields: ["target_persona", "primary_offer", "differentiation"],
      base_priority: 225,
      intent: "Clarify who the site is for, what the offer is, and what makes it stand apart.",
      reason: "This sharpens the page message and fit."
    },
    service_area: {
      components: ["service_area"],
      target_fields: ["service_area_main", "surrounding_cities"],
      base_priority: 180,
      intent: "Clarify the primary market and nearby areas served.",
      reason: "This improves local relevance and targeting."
    },
    proof: {
      components: ["trustbar", "testimonials", "about"],
      target_fields: ["review_quotes", "trust_signal", "years_experience"],
      base_priority: 175,
      intent: "Clarify why someone should trust the business quickly.",
      reason: "Proof makes the site feel credible."
    },
    process: {
      components: ["processSteps"],
      target_fields: ["process_summary"],
      base_priority: 165,
      intent: "Capture the workflow from inquiry to completion.",
      reason: "Process reduces friction and increases trust."
    },
    gallery_strategy: {
      components: ["gallery", "hero"],
      target_fields: ["gallery_visual_direction", "hero_image_query"],
      base_priority: 155,
      intent: "Clarify the visual story the hero and gallery need to tell.",
      reason: "This improves image search query, layout, and count decisions."
    },
    pricing_model: {
      components: ["investment", "faqs", "contact"],
      target_fields: ["pricing", "investment"],
      base_priority: 145,
      intent: "Determine whether pricing is standardized enough for a dedicated investment section.",
      reason: "This clarifies pricing expectations and package fit."
    },
    objection_handling: {
      components: ["faqs"],
      target_fields: ["faq_angles"],
      base_priority: 135,
      intent: "Capture objections and the questions people need answered.",
      reason: "This helps FAQ quality and conversion confidence."
    },
    story: {
      components: ["about"],
      target_fields: ["founder_story"],
      base_priority: 120,
      intent: "Clarify the founder story, philosophy, and standards behind the business.",
      reason: "This strengthens the about section."
    },
    events_strategy: {
      components: ["events"],
      target_fields: ["events"],
      base_priority: 90,
      intent: "Determine whether time-based offerings belong on the site.",
      reason: "This supports schedule-oriented businesses."
    },
    comparison_strategy: {
      components: ["comparison"],
      target_fields: ["comparison"],
      base_priority: 85,
      intent: "Determine whether comparing against alternatives helps buyers decide.",
      reason: "This helps buyers distinguish the offer."
    },
    contact_details: {
      components: ["contact", "brand"],
      target_fields: ["phone", "email", "address", "hours"],
      base_priority: 60,
      intent: "Verify the factual contact details needed for publish-readiness.",
      reason: "These details should be accurate before publish."
    }
  };
}
__name(getDecisionTargets, "getDecisionTargets");
__name2(getDecisionTargets, "getDecisionTargets");
function coreDecisionsStillWeak(decisionStates) {
  const core = ["conversion", "positioning", "service_area", "proof"];
  const avg = core.reduce((sum, key) => sum + Number(decisionStates?.[key]?.confidence || 0), 0) / core.length;
  return avg < 0.7;
}
__name(coreDecisionsStillWeak, "coreDecisionsStillWeak");
__name2(coreDecisionsStillWeak, "coreDecisionsStillWeak");
function looksLikeProcessFact(value) {
  const text = cleanString4(value).toLowerCase();
  if (!text) return false;
  return looksLikeProcessAnswer(text);
}
__name(looksLikeProcessFact, "looksLikeProcessFact");
__name2(looksLikeProcessFact, "looksLikeProcessFact");
function looksLikeProcessAnswer(textLower) {
  const signals = [
    "first",
    "then",
    "after",
    "finally",
    "quote",
    "scope",
    "schedule",
    "walkthrough",
    "complete",
    "finish",
    "follow up"
  ];
  let count = 0;
  for (const signal of signals) {
    if (textLower.includes(signal)) count += 1;
  }
  return count >= 3;
}
__name(looksLikeProcessAnswer, "looksLikeProcessAnswer");
__name2(looksLikeProcessAnswer, "looksLikeProcessAnswer");
function isStandardizedPricing(value) {
  const text = cleanString4(value).toLowerCase();
  if (!text) return false;
  const signals = ["package", "tier", "starting at", "from $", "flat rate", "standard", "basic", "premium"];
  return signals.some((signal) => text.includes(signal));
}
__name(isStandardizedPricing, "isStandardizedPricing");
__name2(isStandardizedPricing, "isStandardizedPricing");
function buildTaglineFromEvidence(factRegistry) {
  const offer = cleanString4(factRegistry?.primary_offer?.value);
  const diff = cleanString4(factRegistry?.differentiation?.value);
  return firstNonEmpty2([offer, diff]);
}
__name(buildTaglineFromEvidence, "buildTaglineFromEvidence");
__name2(buildTaglineFromEvidence, "buildTaglineFromEvidence");
function buildHeroHeadlineFromEvidence({ businessName, offer, differentiation }) {
  if (cleanString4(offer)) return truncate2(offer, 90);
  if (cleanString4(differentiation)) return truncate2(differentiation, 90);
  return `${businessName} built for quality and trust`;
}
__name(buildHeroHeadlineFromEvidence, "buildHeroHeadlineFromEvidence");
__name2(buildHeroHeadlineFromEvidence, "buildHeroHeadlineFromEvidence");
function buildHeroSubtextFromEvidence({ offer, persona, differentiation, bookingMethod }) {
  const parts = [offer, persona, differentiation].map(cleanString4).filter(Boolean);
  let text = parts.slice(0, 2).join(" ");
  if (bookingMethod) {
    text = `${text} Reach out to ${bookingMethod}.`.trim();
  }
  return truncate2(text || "Built to help the right clients feel confident taking the next step.", 220);
}
__name(buildHeroSubtextFromEvidence, "buildHeroSubtextFromEvidence");
__name2(buildHeroSubtextFromEvidence, "buildHeroSubtextFromEvidence");
function stockSearchTailFromRecommendedFocus(focus) {
  const arr = ensureArrayStrings(focus);
  const out = [];
  for (const s of arr) {
    const t = cleanString4(s).toLowerCase();
    if (!t) continue;
    if (/testimonial|pricing|customer|review|quote|engagement|structure|conversion|faq\b/.test(t)) {
      continue;
    }
    out.push(cleanString4(s));
  }
  return out.slice(0, 4).join(" ");
}
__name(stockSearchTailFromRecommendedFocus, "stockSearchTailFromRecommendedFocus");
__name2(stockSearchTailFromRecommendedFocus, "stockSearchTailFromRecommendedFocus");
function buildHeroImageQuery2({ industry, offer, themes, differentiation, recommended_focus }) {
  const themeStr = ensureArrayStrings(themes).join(" ");
  const core = firstNonEmpty2([
    cleanString4(offer),
    cleanString4(industry),
    cleanString4(differentiation),
    themeStr,
    stockSearchTailFromRecommendedFocus(recommended_focus)
  ]);
  const base = core;
  return truncate2(compactVisualQuery(base, ["professional", "premium", "realistic"]), 80);
}
__name(buildHeroImageQuery2, "buildHeroImageQuery2");
__name2(buildHeroImageQuery2, "buildHeroImageQuery");
function buildGalleryImageQuery({ industry, offer, differentiation, themes, recommended_focus }) {
  const themeStr = ensureArrayStrings(themes).join(" ");
  const core = firstNonEmpty2([
    cleanString4(offer),
    cleanString4(industry),
    cleanString4(differentiation),
    themeStr,
    stockSearchTailFromRecommendedFocus(recommended_focus)
  ]);
  return truncate2(compactVisualQuery(core, ["detail", "quality", "realistic"]), 100);
}
__name(buildGalleryImageQuery, "buildGalleryImageQuery");
__name2(buildGalleryImageQuery, "buildGalleryImageQuery");
function compactVisualQuery(base, boosters = []) {
  const text = cleanString4(base);
  if (!text) return boosters.join(" ");
  const words = text.replace(/[.,/#!$%^&*;:{}=\-_`~()]/g, " ").split(/\s+/).map((w) => w.trim()).filter(Boolean);
  return uniqueList2(words.concat(boosters)).slice(0, 8).join(" ");
}
__name(compactVisualQuery, "compactVisualQuery");
__name2(compactVisualQuery, "compactVisualQuery");
function inferGalleryLayout({ vibe, offer, differentiation }) {
  const text = `${cleanString4(vibe)} ${cleanString4(offer)} ${cleanString4(differentiation)}`.toLowerCase();
  if (text.includes("luxury") || text.includes("high-end") || text.includes("premium")) return "bento";
  if (text.includes("portfolio") || text.includes("creative") || text.includes("visual")) return "masonry";
  return "grid";
}
__name(inferGalleryLayout, "inferGalleryLayout");
__name2(inferGalleryLayout, "inferGalleryLayout");
function inferGalleryCount({ offer, differentiation, visualDirection }) {
  const text = `${cleanString4(offer)} ${cleanString4(differentiation)} ${cleanString4(visualDirection)}`.toLowerCase();
  if (text.includes("detailed") || text.includes("before-and-after") || text.includes("portfolio")) return 8;
  if (text.includes("premium") || text.includes("high-end")) return 6;
  return 5;
}
__name(inferGalleryCount, "inferGalleryCount");
__name2(inferGalleryCount, "inferGalleryCount");
function buildServiceAreaTravelNote(mainCity, surrounding) {
  if (mainCity && surrounding.length) {
    return `Outside ${mainCity} and the nearby areas listed here, custom travel quotes are available when the fit is right.`;
  }
  if (mainCity) {
    return `If your project is outside ${mainCity}, reach out and we can discuss travel options.`;
  }
  return "If your project is outside the listed areas, reach out and we can discuss travel options.";
}
__name(buildServiceAreaTravelNote, "buildServiceAreaTravelNote");
__name2(buildServiceAreaTravelNote, "buildServiceAreaTravelNote");
function buildContactSubheadline({ bookingMethod, pricing, contactPath }) {
  if (cleanString4(pricing)) {
    return "Reach out to get the right next step and a quote based on your scope.";
  }
  if (cleanString4(bookingMethod)) {
    return "Use the preferred contact path and we\u2019ll guide you through the next step.";
  }
  if (cleanString4(contactPath)) {
    return "The easiest way to get started is through the contact section below.";
  }
  return "Tell us what you need and we\u2019ll point you toward the right next step.";
}
__name(buildContactSubheadline, "buildContactSubheadline");
__name2(buildContactSubheadline, "buildContactSubheadline");
function buildProcessStepsFromSummary(summary) {
  const text = cleanString4(summary);
  if (!text) return [];
  const lower = text.toLowerCase();
  const steps = [];
  if (lower.includes("quote") || lower.includes("estimate") || lower.includes("inquiry")) {
    steps.push({
      title: "Start with the Right Scope",
      description: "The process begins with a clear understanding of the work, priorities, and project details."
    });
  }
  if (lower.includes("confirm") || lower.includes("scope") || lower.includes("review")) {
    steps.push({
      title: "Confirm the Details",
      description: "Once the scope is clear, the plan is confirmed so expectations feel aligned before work begins."
    });
  }
  if (lower.includes("schedule") || lower.includes("calendar")) {
    steps.push({
      title: "Schedule the Work",
      description: "A time is set that matches the project needs and keeps the process moving smoothly."
    });
  }
  if (lower.includes("complete") || lower.includes("finish") || lower.includes("clean")) {
    steps.push({
      title: "Deliver the Work Carefully",
      description: "The service is completed with attention to detail, quality, and the overall client experience."
    });
  }
  if (lower.includes("walkthrough") || lower.includes("final")) {
    steps.push({
      title: "Review the Final Result",
      description: "A final review helps make sure the outcome feels complete and the client leaves confident."
    });
  }
  if (steps.length < 3) {
    return [
      {
        title: "Start with a Clear Conversation",
        description: "The process starts by understanding the scope, goals, and what success looks like."
      },
      {
        title: "Align on the Right Plan",
        description: "The next step is confirming the best approach so expectations feel clear before work begins."
      },
      {
        title: "Deliver with Care",
        description: "The work is completed with attention to detail, communication, and the final result."
      }
    ];
  }
  return steps.slice(0, 5);
}
__name(buildProcessStepsFromSummary, "buildProcessStepsFromSummary");
__name2(buildProcessStepsFromSummary, "buildProcessStepsFromSummary");
function inferVibe(state) {
  const contract = state?.provenance?.strategy_contract;
  if (!contract) {
    const key = cleanString4(state?.slug) || cleanString4(state?.businessName) || "default";
    return SCHEMA_VIBES[stableHash(key) % SCHEMA_VIBES.length];
  }
  return selectVibe(SCHEMA_VIBES, contract, state);
}
__name(inferVibe, "inferVibe");
__name2(inferVibe, "inferVibe");
function titleCase(text) {
  return cleanString4(text).split(/\s+/).map((word) => word ? `${word[0].toUpperCase()}${word.slice(1)}` : "").join(" ");
}
__name(titleCase, "titleCase");
__name2(titleCase, "titleCase");
function safeFeatureIcon(icon) {
  const cleaned = cleanString4(icon);
  return ALLOWED_ICON_TOKENS2.includes(cleaned) ? cleaned : "check";
}
__name(safeFeatureIcon, "safeFeatureIcon");
__name2(safeFeatureIcon, "safeFeatureIcon");
function isOverloadedQuestion(message, bundleId) {
  const text = cleanString4(message).toLowerCase();
  if (!text) return false;
  const bundleKeywords = {
    conversion: ["book", "booking", "quote", "pricing", "availability", "call", "form", "next step"],
    positioning: ["audience", "customer", "offer", "different", "difference", "stand out", "ideal fit"],
    service_area: ["city", "cities", "area", "areas", "region", "regions", "neighborhood", "neighborhoods", "serve"],
    proof: ["review", "reviews", "trust", "results", "experience", "credibility", "reputation", "testimonial"],
    process: ["process", "workflow", "steps", "inquiry", "completion", "walkthrough"],
    gallery_strategy: ["visual", "images", "gallery", "hero image", "look", "feel"],
    pricing_model: ["tier", "package", "pricing model", "investment"],
    objection_handling: ["questions", "objections", "hesitations", "concerns"],
    story: ["story", "founder", "why", "philosophy", "standards", "started"],
    events_strategy: ["classes", "sessions", "schedule", "events", "workshops", "tours"],
    comparison_strategy: ["compare", "alternatives", "other options"],
    contact_details: ["phone", "email", "address", "hours", "contact", "booking link"]
  };
  const activeBundles = Object.entries(bundleKeywords).map(([key, words]) => ({
    key,
    matched: words.some((word) => text.includes(word))
  })).filter((entry) => entry.matched).map((entry) => entry.key);
  let relevant = activeBundles;
  if (cleanString4(bundleId) === "conversion") {
    relevant = activeBundles.filter((k) => k !== "positioning");
  }
  if (relevant.length <= 1) return false;
  return !relevant.every((key) => key === bundleId);
}
__name(isOverloadedQuestion, "isOverloadedQuestion");
__name2(isOverloadedQuestion, "isOverloadedQuestion");
function looksLikeRepeatedQuestion(message, answerSummary, bundleId) {
  const question = cleanString4(message).toLowerCase();
  const answer = cleanString4(answerSummary).toLowerCase();
  const bundle = cleanString4(bundleId);
  if (!question || !answer || !bundle) return false;
  const repeatedSignals = {
    conversion: ["call", "request a quote", "fill out a form", "book online", "next step"],
    positioning: ["who it is for", "what you offer", "different"],
    service_area: ["what areas", "which cities", "where do you serve"],
    proof: ["why trust", "reviews", "results", "experience"],
    process: ["workflow", "steps", "inquiry to completion"],
    gallery_strategy: ["visual direction", "hero image", "gallery"],
    pricing_model: ["packages", "tiers", "pricing model"],
    objection_handling: ["questions", "objections"],
    story: ["story behind", "why you started", "philosophy"],
    events_strategy: ["classes", "sessions", "schedule"],
    comparison_strategy: ["alternatives", "compare"],
    contact_details: ["phone", "email", "address", "hours"]
  };
  const bundlePhrases = repeatedSignals[bundle] || [];
  const matchedInQuestion = bundlePhrases.some((phrase) => question.includes(phrase));
  const matchedInAnswer = bundlePhrases.some((phrase) => answer.includes(phrase));
  return matchedInQuestion && matchedInAnswer;
}
__name(looksLikeRepeatedQuestion, "looksLikeRepeatedQuestion");
__name2(looksLikeRepeatedQuestion, "looksLikeRepeatedQuestion");
function pickBestPositioningField(factRegistry) {
  const fields = ["differentiation", "target_persona", "primary_offer"];
  let best = null;
  let bestScore = -Infinity;
  for (const key of fields) {
    const fact = factRegistry?.[key];
    if (!fact) continue;
    const status = (fact.status || "").toLowerCase();
    const confidence = typeof fact.confidence === "number" ? fact.confidence : 0;
    let score = 0;
    if (!fact.value || status === "missing") score += 100;
    if (status === "inferred") score += 60;
    if (status === "seeded") score += 40;
    score += (1 - confidence) * 50;
    if (score > bestScore) {
      bestScore = score;
      best = key;
    }
  }
  return best;
}
__name(pickBestPositioningField, "pickBestPositioningField");
__name2(pickBestPositioningField, "pickBestPositioningField");
async function onRequestPost4(context) {
  const { request, env } = context;
  try {
    const rawBody = await request.text();
    let body;
    try {
      body = JSON.parse(rawBody);
    } catch {
      return json4({ ok: false, error: "Invalid JSON payload" }, 400);
    }
    const slug = cleanString5(body.slug);
    if (!slug) {
      return json4({ ok: false, error: "Missing slug", received: body }, 400);
    }
    const usePreflightOverride = isObject4(body.preflight_override) && Object.keys(body.preflight_override).length > 0;
    let reconData;
    if (usePreflightOverride) {
      reconData = normalizePreflightOverrideToReconData(body.preflight_override, slug);
      console.log("[intake-start-v2] preflight_override in use; skipped external preflight fetch");
    } else {
      const url = new URL(request.url);
      const reconReq = new Request(`${url.origin}/api/preflight-status`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ slug })
      });
      const reconRes = await fetch(reconReq);
      reconData = await reconRes.json();
      if (!reconRes.ok || !reconData?.ok) {
        throw new Error(`Preflight data not found for slug: ${slug}.`);
      }
    }
    const strategy = safeStrategy(reconData);
    if (usePreflightOverride) {
      const bc = isObject4(strategy?.business_context) ? strategy.business_context : {};
      console.log("[intake-start-v2] preflight_override: strategy.business_context snapshot:", {
        keys: Object.keys(bc),
        has_business_name: !!cleanString5(bc.business_name),
        has_category: !!cleanString5(bc.category || bc.business_type),
        has_description: !!cleanString5(bc.business_description || bc.summary)
      });
    }
    const seededAnswers = buildSeededAnswers(strategy, reconData);
    const preflight_intelligence = buildPreflightIntelligenceBridge(strategy, reconData, seededAnswers);
    const blueprintBase = buildBlueprintFromPreflight(strategy, reconData, seededAnswers, preflight_intelligence);
    const initialState = {
      slug,
      businessName: cleanString5(reconData?.input_business_name) || cleanString5(strategy?.business_context?.business_name) || cleanString5(seededAnswers?.business_name) || "New Partner",
      clientEmail: cleanString5(reconData?.client_email),
      phase: "blueprint_verify",
      // compatibility fields
      answers: seededAnswers,
      ghostwritten: {},
      verified: {},
      verification: {
        queue_complete: true,
        verified_count: 0,
        remaining_keys: [],
        last_updated: (/* @__PURE__ */ new Date()).toISOString()
      },
      conversation: [],
      meta: {
        category: cleanString5(seededAnswers?.category) || "general",
        intake_version: "v2-blueprint",
        seeded: buildSeedMeta(seededAnswers),
        inferred: {},
        verified: {}
      },
      provenance: {
        strategy_contract: strategy,
        recon_snapshot: reconData
      },
      /** Handoff slice for PREFLIGHT_OUTPUT_SPEC_V1 → intake bridge (question framing, validation tone). */
      preflight_intelligence,
      // new controller state (planner fields filled in Phase 2.6 below)
      blueprint: blueprintBase,
      readiness: {
        score: 0,
        can_generate_now: false,
        remaining_blocks: [],
        satisfied_blocks: [],
        must_verify_open: []
      }
    };
    const schemaGuide = compileSchemaGuide(initialState.blueprint, initialState);
    const recomputed = recomputeBlueprint({
      blueprint: initialState.blueprint,
      state: initialState,
      schemaGuide,
      previousPlan: {},
      lastAudit: null
    });
    console.log("AFTER RECOMPUTE:", {
      bundle: recomputed.blueprint.question_plan?.bundle_id,
      field: recomputed.blueprint.question_plan?.primary_field
    });
    initialState.blueprint = {
      ...recomputed.blueprint,
      schema_guide: schemaGuide
    };
    console.log("AFTER ASSIGN:", {
      bundle: initialState.blueprint.question_plan?.bundle_id,
      field: initialState.blueprint.question_plan?.primary_field
    });
    const plan = initialState.blueprint?.question_plan;
    const factRegistry = initialState.blueprint?.fact_registry;
    if (plan && factRegistry) {
      const pf = cleanString5(plan.primary_field);
      const isConversion = plan.bundle_id === "conversion" || ["booking_method", "booking_url", "contact_path"].includes(pf);
      if (isConversion) {
        const bestField = pickBestPositioningField(factRegistry);
        if (bestField) {
          initialState.blueprint.question_plan = {
            ...plan,
            bundle_id: "positioning",
            primary_field: bestField,
            reason: "positioning_override"
          };
        }
      }
    }
    if (!initialState.blueprint.question_plan) {
      throw new Error("Planner failed to generate initial question_plan");
    }
    const vq = Array.isArray(initialState.blueprint.verification_queue) ? initialState.blueprint.verification_queue : [];
    initialState.verification = {
      queue_complete: vq.length === 0,
      verified_count: 0,
      remaining_keys: vq.map((item) => item.field_key),
      last_updated: (/* @__PURE__ */ new Date()).toISOString()
    };
    initialState.readiness = evaluateBlueprintReadiness2(initialState.blueprint);
    initialState.current_key = initialState.blueprint.question_plan?.primary_field || null;
    const openingMessage = renderQuestion(initialState.blueprint.question_plan, initialState.blueprint, initialState) || fallbackOpeningMessage(initialState);
    initialState.conversation.push({
      role: "assistant",
      content: openingMessage
    });
    if (env.ORCHESTRATOR_SCRIPT_URL) {
      await fetch(`${env.ORCHESTRATOR_SCRIPT_URL}?route=intake_start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug,
          state: initialState,
          timestamp: (/* @__PURE__ */ new Date()).toISOString()
        })
      });
    }
    console.log("FINAL PLAN:", {
      bundle: initialState.blueprint.question_plan?.bundle_id,
      field: initialState.blueprint.question_plan?.primary_field
    });
    return json4({
      ok: true,
      message: openingMessage,
      state: initialState
    });
  } catch (err) {
    console.error("[intake-start-v2]", err);
    return json4({ ok: false, error: err.message || "Unknown error" }, 500);
  }
}
__name(onRequestPost4, "onRequestPost4");
__name2(onRequestPost4, "onRequestPost");
function extractValue(v) {
  if (v == null) return v;
  if (Array.isArray(v)) return v.map((x) => extractValue(x));
  if (!isObject4(v)) return v;
  if ("value" in v) return extractValue(v.value);
  if ("status" in v && "source" in v) return null;
  if ("status" in v) {
    const metaKeys = /* @__PURE__ */ new Set([
      "status",
      "confidence",
      "verified",
      "rationale",
      "source",
      "updated_at",
      "requires_client_verification"
    ]);
    if (Object.keys(v).every((k) => metaKeys.has(k))) return null;
  }
  return v;
}
__name(extractValue, "extractValue");
__name2(extractValue, "extractValue");
function buildInferredFact(value) {
  const leaf = extractValue(value);
  if (!hasMeaningfulValue3(leaf)) return void 0;
  return {
    value: leaf,
    status: "inferred",
    confidence: 0.8,
    verified: false,
    source: "preflight"
  };
}
__name(buildInferredFact, "buildInferredFact");
__name2(buildInferredFact, "buildInferredFact");
function hydrateFactsFromStrategyContract(strategy) {
  if (!strategy) return {};
  const business = strategy.business_context || {};
  const audience = strategy.audience_model || {};
  const conversion = strategy.conversion_strategy || {};
  return {
    target_persona: buildInferredFact(audience?.primary_audience),
    primary_offer: buildInferredFact(business?.primary_offer),
    differentiation: buildInferredFact(business?.differentiation),
    service_area_main: buildInferredFact(business?.location),
    booking_method: buildInferredFact(conversion?.primary_conversion)
  };
}
__name(hydrateFactsFromStrategyContract, "hydrateFactsFromStrategyContract");
__name2(hydrateFactsFromStrategyContract, "hydrateFactsFromStrategyContract");
function json4(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store"
    }
  });
}
__name(json4, "json4");
__name2(json4, "json");
function cleanString5(value) {
  return typeof value === "string" ? value.trim() : "";
}
__name(cleanString5, "cleanString5");
__name2(cleanString5, "cleanString");
function cleanList4(value) {
  if (!Array.isArray(value)) return [];
  return value.map(cleanString5).filter(Boolean);
}
__name(cleanList4, "cleanList4");
__name2(cleanList4, "cleanList");
function isObject4(value) {
  return !!value && typeof value === "object" && !Array.isArray(value);
}
__name(isObject4, "isObject4");
__name2(isObject4, "isObject");
function compactObject(obj) {
  const out = {};
  for (const [key, value] of Object.entries(obj || {})) {
    if (Array.isArray(value) && value.length > 0) {
      out[key] = value;
      continue;
    }
    if (isObject4(value) && Object.keys(value).length > 0) {
      out[key] = value;
      continue;
    }
    if (typeof value === "string" && value.trim()) {
      out[key] = value.trim();
      continue;
    }
    if (typeof value === "boolean") {
      out[key] = value;
    }
  }
  return out;
}
__name(compactObject, "compactObject");
__name2(compactObject, "compactObject");
function hasMeaningfulValue3(value) {
  if (Array.isArray(value)) {
    return value.some((item) => hasMeaningfulValue3(item));
  }
  if (isObject4(value)) {
    return Object.values(value).some((item) => hasMeaningfulValue3(item));
  }
  if (typeof value === "boolean") return true;
  return cleanString5(value) !== "";
}
__name(hasMeaningfulValue3, "hasMeaningfulValue3");
__name2(hasMeaningfulValue3, "hasMeaningfulValue");
function firstNonEmpty3(values) {
  for (const value of values || []) {
    if (Array.isArray(value) && value.length > 0) {
      const nested = firstNonEmpty3(value);
      if (nested) return nested;
      continue;
    }
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return "";
}
__name(firstNonEmpty3, "firstNonEmpty3");
__name2(firstNonEmpty3, "firstNonEmpty");
function uniqueList3(values) {
  return Array.from(new Set(cleanList4(values)));
}
__name(uniqueList3, "uniqueList3");
__name2(uniqueList3, "uniqueList");
function slugify(value) {
  return cleanString5(value).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}
__name(slugify, "slugify");
__name2(slugify, "slugify");
function titleCaseWords(value) {
  return cleanString5(value).split(/\s+/).filter(Boolean).map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase()).join(" ");
}
__name(titleCaseWords, "titleCaseWords");
__name2(titleCaseWords, "titleCaseWords");
function asArray(value) {
  return Array.isArray(value) ? value : [];
}
__name(asArray, "asArray");
__name2(asArray, "asArray");
function normalizePreflightOverrideToReconData(override, slugFromRequest) {
  const o = isObject4(override) ? { ...override } : {};
  const slugVal = cleanString5(o.slug) || slugFromRequest;
  const hasEnvelope = isObject4(o.recon_snapshot) || isObject4(o.strategy_contract) || typeof o.paid_intake_json === "string" && o.paid_intake_json.trim() !== "";
  if (hasEnvelope) {
    return { ok: true, slug: slugVal, ...o, ok: true };
  }
  const strategy_contract = o.strategy_contract;
  const paid_intake_json = o.paid_intake_json;
  const snap = { ...o };
  delete snap.strategy_contract;
  delete snap.paid_intake_json;
  delete snap.slug;
  return compactObject({
    ok: true,
    slug: slugVal,
    input_business_name: cleanString5(o.input_business_name),
    client_email: cleanString5(o.client_email),
    recon_snapshot: compactObject(snap),
    ...isObject4(strategy_contract) ? { strategy_contract } : {},
    ...paid_intake_json != null ? {
      paid_intake_json: typeof paid_intake_json === "string" ? paid_intake_json : JSON.stringify(paid_intake_json)
    } : {}
  });
}
__name(normalizePreflightOverrideToReconData, "normalizePreflightOverrideToReconData");
__name2(normalizePreflightOverrideToReconData, "normalizePreflightOverrideToReconData");
function safeStrategy(reconData) {
  if (!isObject4(reconData)) return {};
  if (isObject4(reconData?.strategy_contract)) {
    return reconData.strategy_contract;
  }
  if (reconData?.paid_intake_json) {
    try {
      const parsed = JSON.parse(reconData.paid_intake_json);
      if (isObject4(parsed?.strategy_contract)) {
        return parsed.strategy_contract;
      }
    } catch {
    }
  }
  return {};
}
__name(safeStrategy, "safeStrategy");
__name2(safeStrategy, "safeStrategy");
function reconPayloadRoot(reconData) {
  const r = isObject4(reconData) ? reconData : {};
  if (isObject4(r.recon_snapshot) && Object.keys(r.recon_snapshot).length) {
    return r.recon_snapshot;
  }
  return r;
}
__name(reconPayloadRoot, "reconPayloadRoot");
__name2(reconPayloadRoot, "reconPayloadRoot");
function safeParseJsonString(raw) {
  if (raw == null) return null;
  if (isObject4(raw) && !Array.isArray(raw)) return raw;
  if (typeof raw !== "string" || !raw.trim()) return null;
  try {
    const parsed = JSON.parse(raw);
    return isObject4(parsed) ? parsed : null;
  } catch {
    return null;
  }
}
__name(safeParseJsonString, "safeParseJsonString");
__name2(safeParseJsonString, "safeParseJsonString");
function clipText(value, maxLen) {
  const s = cleanString5(value);
  if (!s) return "";
  if (s.length <= maxLen) return s;
  return `${s.slice(0, Math.max(0, maxLen - 1))}\u2026`;
}
__name(clipText, "clipText");
__name2(clipText, "clipText");
function entityProfilePositioningHint(ep) {
  if (!isObject4(ep)) return "";
  const cat = cleanString5(ep.primary_category);
  const arch = cleanString5(ep.strategic_archetype);
  const bm = cleanString5(ep.business_model);
  const parts = [cat, arch || bm].filter(Boolean);
  return parts.join(" \xB7 ");
}
__name(entityProfilePositioningHint, "entityProfilePositioningHint");
__name2(entityProfilePositioningHint, "entityProfilePositioningHint");
function normalizeCategory2(value) {
  const raw = cleanString5(value).toLowerCase();
  if (!raw) return "general";
  if (["event", "events", "tour", "tours", "experience", "class", "workshop"].includes(raw)) {
    return "event";
  }
  if (["coach", "coaching", "consultant", "consulting", "advisor", "therapy", "therapist", "trainer"].includes(raw)) {
    return "coach";
  }
  if (["portfolio", "creative", "artist", "designer", "photographer", "videographer"].includes(raw)) {
    return "portfolio";
  }
  return "service";
}
__name(normalizeCategory2, "normalizeCategory2");
__name2(normalizeCategory2, "normalizeCategory");
function buildPreflightIntelligenceBridge(strategy, reconData, seededAnswers) {
  const strategyObj = isObject4(strategy) ? strategy : {};
  const recon = isObject4(reconData) ? reconData : {};
  const blob = reconPayloadRoot(reconData);
  const seeded = isObject4(seededAnswers) ? seededAnswers : {};
  const ps = safeParseJsonString(blob.preflight_strategy_json);
  const bi = safeParseJsonString(blob.buyer_intelligence_json);
  const ep = safeParseJsonString(blob.entity_profile_json);
  const clientPreview = isObject4(ps?.client_preview) ? ps.client_preview : {};
  const internal = isObject4(ps?.internal_strategy) ? ps.internal_strategy : {};
  const aeoAngles = uniqueList3(cleanList4(internal.aeo_angles));
  const ci = isObject4(strategyObj.competitive_intelligence) ? strategyObj.competitive_intelligence : isObject4(recon.competitive_intelligence) ? recon.competitive_intelligence : isObject4(ps?.competitive_intelligence) ? ps.competitive_intelligence : {};
  const summary = cleanString5(clientPreview.summary);
  const opportunityFromPreview = cleanString5(clientPreview.opportunity);
  const salesPreview = cleanString5(clientPreview.sales_preview);
  const nextStepTeaser = cleanString5(clientPreview.next_step_teaser);
  const recommendedFromPreview = cleanList4(clientPreview.recommended_focus);
  const buyerFromIntel = cleanList4(bi?.decision_factors);
  const objectionsFromIntel = cleanList4(bi?.common_objections);
  const trustMarkers = cleanList4(bi?.trust_markers);
  const redFlags = cleanList4(bi?.red_flags_customers_avoid);
  const winning_angle = firstNonEmpty3([
    cleanString5(ci.winning_local_angle),
    cleanString5(ci.winning_local_positioning_angle),
    aeoAngles[0] || "",
    summary ? clipText(summary, 260) : ""
  ]);
  const differentiation_hypothesis = firstNonEmpty3([
    cleanString5(ci.differentiation_hypothesis),
    summary ? clipText(summary, 420) : ""
  ]);
  const positioning = firstNonEmpty3([
    cleanString5(ci.differentiation_hypothesis),
    summary ? clipText(summary, 360) : "",
    entityProfilePositioningHint(ep),
    cleanString5(seeded.business_understanding),
    cleanString5(strategyObj.business_context?.differentiation)
  ]);
  const opportunity = firstNonEmpty3([
    opportunityFromPreview,
    cleanString5(seeded.opportunity),
    cleanString5(strategyObj.business_context?.opportunity)
  ]);
  const website_direction = firstNonEmpty3([
    salesPreview,
    nextStepTeaser,
    cleanString5(seeded.website_direction),
    cleanString5(strategyObj.site_structure?.future_dynamic_vibe_hint)
  ]);
  const buyer_factors = uniqueList3([
    ...cleanList4(ci.buyer_comparison_factors),
    ...cleanList4(ci.what_buyers_compare),
    ...buyerFromIntel
  ]);
  const weaknesses = uniqueList3([
    ...cleanList4(ci.competitor_weaknesses),
    ...cleanList4(ci.likely_competitor_weaknesses),
    ...objectionsFromIntel,
    ...redFlags
  ]);
  const local_alternatives = uniqueList3([
    ...cleanList4(ci.local_alternatives),
    ...cleanList4(ci.typical_local_alternatives)
  ]);
  const recommended_focus = recommendedFromPreview.length ? recommendedFromPreview : uniqueList3(cleanList4(seeded.recommended_focus));
  const experience_model = isObject4(ps?.experience_model) ? ps.experience_model : {};
  const component_importance = isObject4(ps?.component_importance) ? ps.component_importance : {};
  const visual_strategy = isObject4(ps?.visual_strategy) ? ps.visual_strategy : {};
  const process_model = isObject4(ps?.process_model) ? ps.process_model : {};
  const pricing_model = isObject4(ps?.pricing_model) ? ps.pricing_model : {};
  return compactObject({
    positioning,
    opportunity,
    website_direction,
    winning_angle,
    buyer_factors,
    buying_factors: buyer_factors.slice(),
    weaknesses,
    differentiation_hypothesis,
    local_alternatives,
    recommended_focus,
    trust_markers: trustMarkers,
    common_objections: objectionsFromIntel,
    target_persona_hint: firstNonEmpty3([
      cleanString5(strategyObj.audience_model?.primary_persona),
      cleanString5(strategyObj.audience_model?.primary_audience),
      entityProfilePositioningHint(ep)
    ]),
    google_presence_insight: cleanString5(seeded.google_presence_insight),
    experience_model,
    component_importance,
    visual_strategy,
    process_model,
    pricing_model,
    spec_version: Object.keys(experience_model).length || Object.keys(component_importance).length || Object.keys(visual_strategy).length || Object.keys(process_model).length || Object.keys(pricing_model).length ? "PREFLIGHT_OUTPUT_SPEC_V1_1" : "PREFLIGHT_OUTPUT_SPEC_V1"
  });
}
__name(buildPreflightIntelligenceBridge, "buildPreflightIntelligenceBridge");
__name2(buildPreflightIntelligenceBridge, "buildPreflightIntelligenceBridge");
function mergeAnglesFromPreflightStrategy(strategy, reconData) {
  const fromContract = isObject4(strategy?.internal_strategy) ? strategy.internal_strategy : {};
  const root = reconPayloadRoot(reconData);
  const ps = safeParseJsonString(root?.preflight_strategy_json);
  const internal = isObject4(ps?.internal_strategy) ? ps.internal_strategy : {};
  return {
    faq_angles: uniqueList3([
      ...cleanList4(internal.faq_angles),
      ...cleanList4(fromContract.faq_angles)
    ]),
    aeo_angles: uniqueList3([
      ...cleanList4(internal.aeo_angles),
      ...cleanList4(fromContract.aeo_angles)
    ])
  };
}
__name(mergeAnglesFromPreflightStrategy, "mergeAnglesFromPreflightStrategy");
__name2(mergeAnglesFromPreflightStrategy, "mergeAnglesFromPreflightStrategy");
function buildSeededAnswers(strategy, reconData) {
  const businessContext = isObject4(strategy?.business_context) ? strategy.business_context : {};
  const conversionStrategy = isObject4(strategy?.conversion_strategy) ? strategy.conversion_strategy : {};
  const audienceModel = isObject4(strategy?.audience_model) ? strategy.audience_model : {};
  const proofModel = isObject4(strategy?.proof_model) ? strategy.proof_model : {};
  const siteStructure = isObject4(strategy?.site_structure) ? strategy.site_structure : {};
  const sourceSnapshot = isObject4(strategy?.source_snapshot) ? strategy.source_snapshot : {};
  const clientPreview = isObject4(sourceSnapshot?.client_preview) ? sourceSnapshot.client_preview : {};
  const napRecommendation = isObject4(sourceSnapshot?.nap_recommendation) ? sourceSnapshot.nap_recommendation : {};
  const reconSnapshot = isObject4(reconData) ? reconData : {};
  const root = reconPayloadRoot(reconData);
  const entityProfile = safeParseJsonString(root?.entity_profile_json);
  const anglesFromPs = mergeAnglesFromPreflightStrategy(strategy, reconData);
  const serviceAreas = uniqueList3([
    ...cleanList4(businessContext?.service_area),
    ...cleanList4(napRecommendation?.service_area)
  ]);
  const bookingMethod = deriveBookingMethod(strategy, reconData);
  const contactPath = deriveContactPath(strategy, reconData);
  const cta = deriveCta(strategy, reconData);
  const trustSignal = deriveTrustSignal(strategy, reconData);
  const websiteDirection = deriveWebsiteDirection(strategy, reconData);
  const opportunity = deriveOpportunity(strategy, reconData);
  const recommendedFocus = deriveRecommendedFocus(strategy, reconData);
  const recommendedSections = deriveRecommendedSections(strategy, reconData);
  return compactObject({
    business_name: cleanString5(businessContext?.business_name) || cleanString5(reconSnapshot?.input_business_name) || cleanString5(napRecommendation?.name),
    category: normalizeCategory2(
      businessContext?.category || businessContext?.business_type || strategy?.internal_strategy?.business_category || "general"
    ),
    primary_offer: cleanString5(sourceSnapshot?.primary_offer_hint) || cleanString5(reconSnapshot?.description_input) || cleanString5(reconSnapshot?.primary_offer) || cleanString5(reconSnapshot?.business_understanding),
    audience: cleanString5(audienceModel?.primary_persona) || cleanString5(audienceModel?.secondary_persona) || entityProfilePositioningHint(entityProfile),
    service_area: serviceAreas[0] || "",
    service_areas: serviceAreas,
    trust_signal: trustSignal,
    contact_path: contactPath,
    booking_method: bookingMethod,
    cta_text: cta.text,
    cta_link: cta.link,
    primary_conversion: cleanString5(conversionStrategy?.primary_conversion),
    secondary_conversion: cleanString5(conversionStrategy?.secondary_conversion),
    conversion_mode: cleanString5(conversionStrategy?.conversion_mode),
    differentiation: firstNonEmpty3([
      cleanList4(audienceModel?.decision_factors),
      cleanList4(recommendedFocus)
    ]) || "",
    website_direction: websiteDirection,
    business_understanding: cleanString5(clientPreview?.summary) || cleanString5(reconSnapshot?.business_understanding),
    opportunity,
    recommended_focus: recommendedFocus,
    recommended_sections: recommendedSections,
    faq_angles: uniqueList3([...cleanList4(siteStructure?.faq_angles), ...anglesFromPs.faq_angles]),
    aeo_angles: uniqueList3([...cleanList4(siteStructure?.aeo_angles), ...anglesFromPs.aeo_angles]),
    future_dynamic_vibe_hint: cleanString5(siteStructure?.future_dynamic_vibe_hint),
    google_presence_insight: cleanString5(reconSnapshot?.google_presence_insight) || cleanString5(sourceSnapshot?.gbp_status),
    next_step_teaser: cleanString5(clientPreview?.next_step_teaser) || cleanString5(reconSnapshot?.next_step)
  });
}
__name(buildSeededAnswers, "buildSeededAnswers");
__name2(buildSeededAnswers, "buildSeededAnswers");
function deriveBookingMethod(strategy, reconData) {
  const conversion = isObject4(strategy?.conversion_strategy) ? strategy.conversion_strategy : {};
  const sourceSnapshot = isObject4(strategy?.source_snapshot) ? strategy.source_snapshot : {};
  const reconSnapshot = isObject4(reconData) ? reconData : {};
  const explicit = firstNonEmpty3([
    cleanString5(sourceSnapshot?.booking_method_hint),
    cleanString5(sourceSnapshot?.booking_url),
    cleanString5(reconSnapshot?.booking_url),
    cleanString5(reconSnapshot?.booking_method),
    cleanString5(strategy?.contact?.booking_url),
    cleanString5(strategy?.contact?.method)
  ]);
  if (explicit) return explicit;
  const mode = cleanString5(conversion?.conversion_mode || conversion?.primary_conversion).toLowerCase();
  if (mode.includes("quote")) return "request quote";
  if (mode.includes("book")) return "book online";
  if (mode.includes("call")) return "call";
  if (mode.includes("text")) return "text";
  if (mode.includes("form")) return "contact form";
  return "";
}
__name(deriveBookingMethod, "deriveBookingMethod");
__name2(deriveBookingMethod, "deriveBookingMethod");
function deriveContactPath(strategy, reconData) {
  const conversion = isObject4(strategy?.conversion_strategy) ? strategy.conversion_strategy : {};
  const sourceSnapshot = isObject4(strategy?.source_snapshot) ? strategy.source_snapshot : {};
  const napRecommendation = isObject4(sourceSnapshot?.nap_recommendation) ? sourceSnapshot.nap_recommendation : {};
  const reconSnapshot = isObject4(reconData) ? reconData : {};
  const explicit = firstNonEmpty3([
    cleanString5(sourceSnapshot?.booking_url),
    cleanString5(reconSnapshot?.booking_url),
    cleanString5(strategy?.contact?.booking_url),
    cleanString5(strategy?.contact?.method),
    cleanString5(napRecommendation?.phone),
    cleanString5(reconSnapshot?.client_phone)
  ]);
  if (explicit) return explicit;
  const destination = cleanString5(conversion?.cta_destination).toLowerCase();
  const mode = cleanString5(conversion?.conversion_mode || conversion?.primary_conversion).toLowerCase();
  if (destination === "contact") return "contact";
  if (destination) return destination;
  if (mode.includes("quote")) return "request quote";
  if (mode.includes("call")) return "call";
  if (mode.includes("book")) return "book online";
  if (mode.includes("form")) return "contact form";
  return "";
}
__name(deriveContactPath, "deriveContactPath");
__name2(deriveContactPath, "deriveContactPath");
function deriveCta(strategy, reconData) {
  const conversion = isObject4(strategy?.conversion_strategy) ? strategy.conversion_strategy : {};
  const settings = isObject4(strategy?.settings) ? strategy.settings : {};
  const reconSnapshot = isObject4(reconData) ? reconData : {};
  const text = cleanString5(conversion?.cta_text) || cleanString5(settings?.cta_text) || cleanString5(reconSnapshot?.cta_text);
  const destination = cleanString5(conversion?.cta_destination) || cleanString5(settings?.cta_link) || cleanString5(reconSnapshot?.cta_link);
  const type = cleanString5(conversion?.cta_type) || cleanString5(settings?.cta_type);
  let link = destination;
  if (!link && text) {
    link = type === "anchor" ? "#contact" : "";
  } else if (link && !link.startsWith("#") && type === "anchor") {
    link = `#${link.replace(/^#/, "")}`;
  }
  return {
    text,
    link
  };
}
__name(deriveCta, "deriveCta");
__name2(deriveCta, "deriveCta");
function deriveTrustSignal(strategy, reconData) {
  const proofModel = isObject4(strategy?.proof_model) ? strategy.proof_model : {};
  const audienceModel = isObject4(strategy?.audience_model) ? strategy.audience_model : {};
  const sourceSnapshot = isObject4(strategy?.source_snapshot) ? strategy.source_snapshot : {};
  const reconSnapshot = isObject4(reconData) ? reconData : {};
  return firstNonEmpty3([
    cleanList4(proofModel?.trust_signals),
    cleanList4(proofModel?.credibility_sources),
    cleanList4(audienceModel?.decision_factors),
    cleanString5(reconSnapshot?.google_presence_insight),
    cleanString5(sourceSnapshot?.trust_hint)
  ]);
}
__name(deriveTrustSignal, "deriveTrustSignal");
__name2(deriveTrustSignal, "deriveTrustSignal");
function deriveWebsiteDirection(strategy, reconData) {
  const sourceSnapshot = isObject4(strategy?.source_snapshot) ? strategy.source_snapshot : {};
  const clientPreview = isObject4(sourceSnapshot?.client_preview) ? sourceSnapshot.client_preview : {};
  const reconSnapshot = isObject4(reconData) ? reconData : {};
  return firstNonEmpty3([
    cleanString5(clientPreview?.sales_preview),
    cleanString5(reconSnapshot?.website_direction),
    cleanString5(clientPreview?.summary)
  ]);
}
__name(deriveWebsiteDirection, "deriveWebsiteDirection");
__name2(deriveWebsiteDirection, "deriveWebsiteDirection");
function deriveOpportunity(strategy, reconData) {
  const sourceSnapshot = isObject4(strategy?.source_snapshot) ? strategy.source_snapshot : {};
  const clientPreview = isObject4(sourceSnapshot?.client_preview) ? sourceSnapshot.client_preview : {};
  const reconSnapshot = isObject4(reconData) ? reconData : {};
  return firstNonEmpty3([
    cleanString5(clientPreview?.opportunity),
    cleanString5(reconSnapshot?.opportunity)
  ]);
}
__name(deriveOpportunity, "deriveOpportunity");
__name2(deriveOpportunity, "deriveOpportunity");
function deriveRecommendedFocus(strategy, reconData) {
  const siteStructure = isObject4(strategy?.site_structure) ? strategy.site_structure : {};
  const sourceSnapshot = isObject4(strategy?.source_snapshot) ? strategy.source_snapshot : {};
  const clientPreview = isObject4(sourceSnapshot?.client_preview) ? sourceSnapshot.client_preview : {};
  const reconSnapshot = isObject4(reconData) ? reconData : {};
  return uniqueList3([
    ...cleanList4(clientPreview?.recommended_focus),
    ...cleanList4(reconSnapshot?.recommended_focus),
    ...cleanList4(siteStructure?.faq_angles)
  ]).slice(0, 6);
}
__name(deriveRecommendedFocus, "deriveRecommendedFocus");
__name2(deriveRecommendedFocus, "deriveRecommendedFocus");
function deriveRecommendedSections(strategy, reconData) {
  const siteStructure = isObject4(strategy?.site_structure) ? strategy.site_structure : {};
  const reconSnapshot = isObject4(reconData) ? reconData : {};
  return uniqueList3([
    ...cleanList4(siteStructure?.recommended_sections),
    ...cleanList4(reconSnapshot?.recommended_sections)
  ]);
}
__name(deriveRecommendedSections, "deriveRecommendedSections");
__name2(deriveRecommendedSections, "deriveRecommendedSections");
function buildSeedMeta(seededAnswers) {
  const seeded = {};
  for (const [key, value] of Object.entries(seededAnswers || {})) {
    seeded[key] = hasMeaningfulValue3(value);
  }
  return seeded;
}
__name(buildSeedMeta, "buildSeedMeta");
__name2(buildSeedMeta, "buildSeedMeta");
function buildBlueprintFromPreflight(strategy, reconData, seededAnswers, preflightIntelligence) {
  const normalizedStrategy = buildNormalizedStrategy(strategy, reconData, preflightIntelligence);
  let factRegistry = buildFactRegistry(strategy, reconData, seededAnswers, normalizedStrategy);
  const inferredFacts = hydrateFactsFromStrategyContract(strategy);
  factRegistry = {
    ...factRegistry,
    ...Object.fromEntries(Object.entries(inferredFacts).filter(([_, v]) => v !== void 0))
  };
  hydrateFactRegistryWithPreflightIntelligence(factRegistry, preflightIntelligence);
  promotePreflightFactsToRegistry(factRegistry, reconData, preflightIntelligence);
  const forceValidationFields = ["differentiation", "target_persona", "primary_offer"];
  forceValidationFields.forEach((key) => {
    const fact = factRegistry[key];
    if (!fact) return;
    if (fact.status === "seeded" || fact.status === "inferred") {
      fact.needs_validation = true;
    }
  });
  const businessDraft = buildBusinessDraft(strategy, reconData, seededAnswers, normalizedStrategy, factRegistry);
  const sectionStatus = computeSectionStatus2(normalizedStrategy, factRegistry, businessDraft);
  return {
    strategy: normalizedStrategy,
    fact_registry: factRegistry,
    business_draft: businessDraft,
    section_status: sectionStatus,
    verification_queue: [],
    question_candidates: [],
    question_plan: null
  };
}
__name(buildBlueprintFromPreflight, "buildBlueprintFromPreflight");
__name2(buildBlueprintFromPreflight, "buildBlueprintFromPreflight");
function toSnakeCase(value) {
  return cleanString5(value).replace(/([a-z0-9])([A-Z])/g, "$1_$2").replace(/[^a-zA-Z0-9]+/g, "_").replace(/^_+|_+$/g, "").toLowerCase();
}
__name(toSnakeCase, "toSnakeCase");
__name2(toSnakeCase, "toSnakeCase");
function buildPreflightPromotionSources(reconData) {
  const root = reconPayloadRoot(reconData);
  const preflight = isObject4(root?.preflight) ? root.preflight : {};
  const parsedSummary = safeParseJsonString(preflight?.summary) || safeParseJsonString(root?.summary) || safeParseJsonString(root?.preflight_summary_json);
  const input = isObject4(preflight?.input) ? preflight.input : isObject4(root?.input) ? root.input : root;
  const summary = isObject4(parsedSummary) ? parsedSummary : isObject4(preflight?.summary) ? preflight.summary : isObject4(root?.summary) ? root.summary : {};
  return { input, summary };
}
__name(buildPreflightPromotionSources, "buildPreflightPromotionSources");
__name2(buildPreflightPromotionSources, "buildPreflightPromotionSources");
function mapPreflightSourceKeyToFactKey(sourceKey) {
  let k = toSnakeCase(sourceKey);
  if (!k) return "";
  if (k.startsWith("summary_")) k = k.slice("summary_".length);
  if (k.startsWith("input_") && k !== "input_business_name") k = k.slice("input_".length);
  const aliases = {
    input_business_name: "business_name",
    business_name: "business_name",
    city: "service_area_main",
    city_or_service_area_input: "service_area_main",
    service_area: "service_area_main",
    service_area_main: "service_area_main",
    client_email: "email",
    email: "email",
    client_phone: "phone",
    phone: "phone",
    address: "address",
    hours: "hours",
    primary_offer: "primary_offer",
    differentiation: "differentiation",
    differentiation_hypothesis: "differentiation",
    positioning: "business_understanding",
    target_persona: "target_persona",
    audience: "target_persona",
    tagline: "tagline",
    service_descriptions: "service_list",
    process_summary: "process_summary",
    opportunity: "opportunity",
    trust_signal: "trust_signal",
    trust_markers: "trust_signal",
    recommended_focus: "recommended_focus",
    winning_angle: "aeo_angles",
    website_direction: "website_direction"
  };
  return aliases[k] || k;
}
__name(mapPreflightSourceKeyToFactKey, "mapPreflightSourceKeyToFactKey");
__name2(mapPreflightSourceKeyToFactKey, "mapPreflightSourceKeyToFactKey");
function canPromoteIntoFact(entry) {
  if (!isObject4(entry)) return false;
  if (entry.verified === true) return false;
  const status = cleanString5(entry.status);
  if (status === "answered") return false;
  const confidence = typeof entry.confidence === "number" ? entry.confidence : 0;
  if (confidence >= 0.8) return false;
  return true;
}
__name(canPromoteIntoFact, "canPromoteIntoFact");
__name2(canPromoteIntoFact, "canPromoteIntoFact");
function promoteFactFromPreflightSource(facts, sourceObj, sourceKind) {
  if (!isObject4(facts) || !isObject4(sourceObj)) return;
  const fromInput = sourceKind === "input";
  for (const [rawKey, rawValue] of Object.entries(sourceObj)) {
    const factKey = mapPreflightSourceKeyToFactKey(rawKey);
    if (!factKey || !Object.prototype.hasOwnProperty.call(facts, factKey)) continue;
    const value = extractValue(rawValue);
    if (!hasMeaningfulValue3(value)) continue;
    const current = facts[factKey];
    if (!canPromoteIntoFact(current)) continue;
    if (fromInput) {
      facts[factKey] = {
        ...current,
        value,
        source: "preflight",
        status: "verified",
        confidence: 0.95,
        verified: true
      };
    } else {
      facts[factKey] = {
        ...current,
        value,
        source: "preflight",
        status: "inferred",
        confidence: 0.75,
        verified: false
      };
    }
  }
}
__name(promoteFactFromPreflightSource, "promoteFactFromPreflightSource");
__name2(promoteFactFromPreflightSource, "promoteFactFromPreflightSource");
function buildSummaryPromotionPayloadFromPreflightIntelligence(pi) {
  if (!isObject4(pi)) return {};
  const trustFirst = cleanList4(pi.trust_markers)[0];
  const win = cleanString5(pi.winning_angle);
  return compactObject({
    business_understanding: cleanString5(pi.positioning),
    opportunity: cleanString5(pi.opportunity),
    differentiation: cleanString5(pi.differentiation_hypothesis),
    trust_signal: trustFirst,
    recommended_focus: cleanList4(pi.recommended_focus),
    aeo_angles: win ? [win] : [],
    website_direction: cleanString5(pi.website_direction)
  });
}
__name(buildSummaryPromotionPayloadFromPreflightIntelligence, "buildSummaryPromotionPayloadFromPreflightIntelligence");
__name2(buildSummaryPromotionPayloadFromPreflightIntelligence, "buildSummaryPromotionPayloadFromPreflightIntelligence");
function promotePreflightFactsToRegistry(facts, reconData, preflightIntelligence) {
  const { input, summary } = buildPreflightPromotionSources(reconData);
  const fromBridge = buildSummaryPromotionPayloadFromPreflightIntelligence(preflightIntelligence);
  const mergedSummary = { ...summary, ...fromBridge };
  promoteFactFromPreflightSource(facts, input, "input");
  promoteFactFromPreflightSource(facts, mergedSummary, "summary");
}
__name(promotePreflightFactsToRegistry, "promotePreflightFactsToRegistry");
__name2(promotePreflightFactsToRegistry, "promotePreflightFactsToRegistry");
function buildNormalizedStrategy(strategy, reconData, preflightIntelligence) {
  const businessContext = isObject4(strategy?.business_context) ? strategy.business_context : {};
  const conversionStrategy = isObject4(strategy?.conversion_strategy) ? strategy.conversion_strategy : {};
  const audienceModel = isObject4(strategy?.audience_model) ? strategy.audience_model : {};
  const proofModel = isObject4(strategy?.proof_model) ? strategy.proof_model : {};
  const siteStructure = isObject4(strategy?.site_structure) ? strategy.site_structure : {};
  const visualStrategy = isObject4(strategy?.visual_strategy) ? strategy.visual_strategy : {};
  const assetPolicy = isObject4(strategy?.asset_policy) ? strategy.asset_policy : {};
  const copyPolicy = isObject4(strategy?.copy_policy) ? strategy.copy_policy : {};
  const contentRequirements = isObject4(strategy?.content_requirements) ? strategy.content_requirements : {};
  const schemaToggles = isObject4(strategy?.schema_toggles) ? strategy.schema_toggles : {};
  const sourceSnapshot = isObject4(strategy?.source_snapshot) ? strategy.source_snapshot : {};
  const napRecommendation = isObject4(sourceSnapshot?.nap_recommendation) ? sourceSnapshot.nap_recommendation : {};
  const reconSnapshot = isObject4(reconData) ? reconData : {};
  const reconRoot = reconPayloadRoot(reconData);
  const entityProfile = safeParseJsonString(reconRoot?.entity_profile_json);
  const serviceArea = uniqueList3([
    ...cleanList4(businessContext?.service_area),
    ...cleanList4(napRecommendation?.service_area),
    ...cleanList4(entityProfile?.service_area),
    cleanString5(reconSnapshot?.city_or_service_area_input)
  ]);
  return {
    business_context: {
      slug: cleanString5(businessContext?.slug) || cleanString5(reconSnapshot?.slug),
      business_name: cleanString5(businessContext?.business_name) || cleanString5(reconSnapshot?.input_business_name) || cleanString5(napRecommendation?.name),
      category: cleanString5(businessContext?.category) || cleanString5(businessContext?.business_type) || cleanString5(entityProfile?.primary_category),
      normalized_category: normalizeCategory2(
        businessContext?.category || businessContext?.business_type || strategy?.internal_strategy?.business_category || cleanString5(entityProfile?.primary_category) || "general"
      ),
      business_model: cleanString5(
        firstNonEmpty3([businessContext?.business_model, entityProfile?.business_model])
      ),
      strategic_archetype: cleanString5(
        firstNonEmpty3([businessContext?.strategic_archetype, entityProfile?.strategic_archetype])
      ),
      service_area: serviceArea
    },
    conversion_strategy: {
      primary_conversion: cleanString5(conversionStrategy?.primary_conversion),
      secondary_conversion: cleanString5(conversionStrategy?.secondary_conversion),
      conversion_mode: cleanString5(conversionStrategy?.conversion_mode),
      cta_text: cleanString5(conversionStrategy?.cta_text),
      cta_type: cleanString5(conversionStrategy?.cta_type) || "anchor",
      cta_destination: cleanString5(conversionStrategy?.cta_destination) || "contact"
    },
    audience_model: {
      primary_persona: cleanString5(audienceModel?.primary_persona),
      secondary_persona: cleanString5(audienceModel?.secondary_persona),
      decision_factors: cleanList4(audienceModel?.decision_factors),
      common_objections: cleanList4(audienceModel?.common_objections)
    },
    proof_model: {
      trust_signals: cleanList4(proofModel?.trust_signals),
      credibility_sources: cleanList4(proofModel?.credibility_sources)
    },
    site_structure: {
      recommended_sections: cleanList4(siteStructure?.recommended_sections),
      faq_angles: cleanList4(siteStructure?.faq_angles),
      aeo_angles: cleanList4(siteStructure?.aeo_angles),
      future_dynamic_vibe_hint: cleanString5(siteStructure?.future_dynamic_vibe_hint)
    },
    visual_strategy: {
      recommended_vibe: cleanString5(visualStrategy?.recommended_vibe) || "",
      preferred_image_themes: cleanList4(assetPolicy?.preferred_image_themes)
    },
    copy_policy: {
      allow_ai_inferred_copy: !!copyPolicy?.allow_ai_inferred_copy,
      allow_ai_assisted_copy: !!copyPolicy?.allow_ai_assisted_copy,
      require_client_verification_for_facts: !!copyPolicy?.require_client_verification_for_facts,
      fields_ai_can_draft: cleanList4(copyPolicy?.fields_ai_can_draft),
      fields_requiring_verification: cleanList4(copyPolicy?.fields_requiring_verification)
    },
    content_requirements: {
      must_verify_now: cleanList4(contentRequirements?.must_verify_now),
      must_collect_paid_phase: cleanList4(contentRequirements?.must_collect_paid_phase),
      preview_required_fields: cleanList4(contentRequirements?.preview_required_fields),
      publish_required_fields: cleanList4(contentRequirements?.publish_required_fields)
    },
    schema_toggles: normalizeSchemaToggles(schemaToggles, strategy, reconData, preflightIntelligence)
  };
}
__name(buildNormalizedStrategy, "buildNormalizedStrategy");
__name2(buildNormalizedStrategy, "buildNormalizedStrategy");
function componentImportanceRank(value) {
  const v = cleanString5(value).toLowerCase();
  const rank = { none: 0, low: 1, medium: 2, high: 3, critical: 4 };
  return rank[v] ?? 0;
}
__name(componentImportanceRank, "componentImportanceRank");
__name2(componentImportanceRank, "componentImportanceRank");
function importanceAtLeast(importance, key, minLevel) {
  if (!isObject4(importance)) return false;
  return componentImportanceRank(importance[key]) >= componentImportanceRank(minLevel);
}
__name(importanceAtLeast, "importanceAtLeast");
__name2(importanceAtLeast, "importanceAtLeast");
function mergeComponentImportanceIntoInferred(componentImportance, inferred) {
  const ci = isObject4(componentImportance) ? componentImportance : {};
  if (!Object.keys(ci).length) return inferred;
  const out = { ...inferred };
  if (importanceAtLeast(ci, "gallery", "high")) out.show_gallery = true;
  if (importanceAtLeast(ci, "process", "high")) out.show_process = true;
  if (importanceAtLeast(ci, "testimonials", "high")) out.show_testimonials = true;
  if (importanceAtLeast(ci, "faqs", "medium")) out.show_faqs = true;
  if (importanceAtLeast(ci, "investment", "medium") || importanceAtLeast(ci, "pricing_section", "medium")) {
    out.show_investment = true;
  }
  if (importanceAtLeast(ci, "comparison", "medium")) out.show_comparison = true;
  if (importanceAtLeast(ci, "service_area", "medium")) out.show_service_area = true;
  if (importanceAtLeast(ci, "events_or_booking", "medium")) out.show_events = true;
  if (importanceAtLeast(ci, "testimonials", "medium") || importanceAtLeast(ci, "gallery", "medium")) {
    out.show_trustbar = true;
  }
  if (importanceAtLeast(ci, "gallery", "medium") && importanceAtLeast(ci, "process", "medium")) {
    out.show_features = true;
  }
  return out;
}
__name(mergeComponentImportanceIntoInferred, "mergeComponentImportanceIntoInferred");
__name2(mergeComponentImportanceIntoInferred, "mergeComponentImportanceIntoInferred");
function normalizeSchemaToggles(schemaToggles, strategy, reconData, preflightIntelligence) {
  const recommendedSections = deriveRecommendedSections(strategy, reconData).map((item) => item.toLowerCase());
  const inferred = {
    show_trustbar: recommendedSections.some((s) => s.includes("trust")),
    show_about: recommendedSections.some((s) => s.includes("about")),
    show_features: recommendedSections.some((s) => s.includes("service")) || recommendedSections.some((s) => s.includes("feature")) || recommendedSections.some((s) => s.includes("offer")),
    show_events: recommendedSections.some((s) => s.includes("event")),
    show_process: recommendedSections.some((s) => s.includes("process")),
    show_testimonials: recommendedSections.some((s) => s.includes("testimonial")) || recommendedSections.some((s) => s.includes("review")),
    show_comparison: recommendedSections.some((s) => s.includes("comparison")),
    show_gallery: recommendedSections.some((s) => s.includes("gallery")) || recommendedSections.some((s) => s.includes("portfolio")),
    show_investment: recommendedSections.some((s) => s.includes("investment")) || recommendedSections.some((s) => s.includes("pricing")),
    show_faqs: recommendedSections.some((s) => s.includes("faq")),
    show_service_area: recommendedSections.some((s) => s.includes("area")) || recommendedSections.some((s) => s.includes("location"))
  };
  const merged = mergeComponentImportanceIntoInferred(
    preflightIntelligence?.component_importance,
    inferred
  );
  return {
    show_trustbar: getBoolean(schemaToggles?.show_trustbar, merged.show_trustbar),
    show_about: getBoolean(schemaToggles?.show_about, merged.show_about),
    show_features: getBoolean(schemaToggles?.show_features, merged.show_features || true),
    show_events: getBoolean(schemaToggles?.show_events, merged.show_events),
    show_process: getBoolean(schemaToggles?.show_process, merged.show_process),
    show_testimonials: getBoolean(schemaToggles?.show_testimonials, merged.show_testimonials),
    show_comparison: getBoolean(schemaToggles?.show_comparison, merged.show_comparison),
    show_gallery: getBoolean(schemaToggles?.show_gallery, merged.show_gallery),
    show_investment: getBoolean(schemaToggles?.show_investment, merged.show_investment),
    show_faqs: getBoolean(schemaToggles?.show_faqs, merged.show_faqs),
    show_service_area: getBoolean(schemaToggles?.show_service_area, merged.show_service_area)
  };
}
__name(normalizeSchemaToggles, "normalizeSchemaToggles");
__name2(normalizeSchemaToggles, "normalizeSchemaToggles");
function getBoolean(value, fallback = false) {
  return typeof value === "boolean" ? value : !!fallback;
}
__name(getBoolean, "getBoolean");
__name2(getBoolean, "getBoolean");
function buildFactRegistry(strategy, reconData, seededAnswers, normalizedStrategy) {
  const sourceSnapshot = isObject4(strategy?.source_snapshot) ? strategy.source_snapshot : {};
  const clientPreview = isObject4(sourceSnapshot?.client_preview) ? sourceSnapshot.client_preview : {};
  const napRecommendation = isObject4(sourceSnapshot?.nap_recommendation) ? sourceSnapshot.nap_recommendation : {};
  const visualStrategy = isObject4(strategy?.visual_strategy) ? strategy.visual_strategy : {};
  const copyPolicy = normalizedStrategy.copy_policy;
  const facts = {};
  addFact(facts, "business_name", seededAnswers.business_name, {
    source: "preflight",
    verified: true,
    related_sections: ["brand"]
  });
  addFact(facts, "industry", normalizedStrategy.business_context.category, {
    source: "preflight",
    verified: true,
    related_sections: ["intelligence"]
  });
  addFact(facts, "target_persona", seededAnswers.audience, {
    source: "preflight",
    related_sections: ["intelligence", "hero", "features"]
  });
  addFact(facts, "tone_of_voice", inferToneOfVoice(strategy, seededAnswers), {
    source: "inferred",
    related_sections: ["intelligence", "brand", "hero"]
  });
  addFact(facts, "primary_offer", seededAnswers.primary_offer, {
    source: "preflight",
    related_sections: ["hero", "features"]
  });
  addFact(facts, "service_area_main", seededAnswers.service_area, {
    source: "preflight",
    related_sections: ["service_area", "hero"]
  });
  addFact(facts, "service_area_list", seededAnswers.service_areas, {
    source: "preflight",
    related_sections: ["service_area"]
  });
  addFact(facts, "primary_conversion", seededAnswers.primary_conversion, {
    source: "preflight",
    related_sections: ["settings", "contact"]
  });
  addFact(facts, "secondary_conversion", seededAnswers.secondary_conversion, {
    source: "preflight",
    related_sections: ["settings", "contact"]
  });
  addFact(facts, "conversion_mode", seededAnswers.conversion_mode, {
    source: "preflight",
    related_sections: ["settings", "contact"]
  });
  addFact(facts, "cta_text", seededAnswers.cta_text, {
    source: "preflight",
    related_sections: ["settings", "contact"]
  });
  addFact(facts, "cta_link", seededAnswers.cta_link, {
    source: "preflight",
    related_sections: ["settings", "contact"]
  });
  addFact(facts, "contact_path", seededAnswers.contact_path, {
    source: "preflight",
    related_sections: ["contact"]
  });
  addFact(facts, "booking_method", seededAnswers.booking_method, {
    source: "preflight",
    related_sections: ["contact", "hero"]
  });
  addFact(facts, "trust_signal", seededAnswers.trust_signal, {
    source: "preflight",
    related_sections: ["trustbar", "testimonials", "about"]
  });
  addFact(facts, "differentiation", seededAnswers.differentiation, {
    source: "preflight",
    related_sections: ["hero", "about", "features"]
  });
  addFact(facts, "website_direction", seededAnswers.website_direction, {
    source: "preflight",
    related_sections: ["hero", "about"]
  });
  addFact(facts, "business_understanding", seededAnswers.business_understanding, {
    source: "preflight",
    related_sections: ["hero", "about"]
  });
  addFact(facts, "opportunity", seededAnswers.opportunity, {
    source: "preflight",
    related_sections: ["hero", "about", "faqs"]
  });
  addFact(facts, "recommended_focus", seededAnswers.recommended_focus, {
    source: "preflight",
    related_sections: ["features", "hero", "faqs"]
  });
  addFact(facts, "recommended_sections", seededAnswers.recommended_sections, {
    source: "preflight",
    verified: true,
    related_sections: ["strategy"]
  });
  addFact(facts, "faq_angles", seededAnswers.faq_angles, {
    source: "preflight",
    related_sections: ["faqs"]
  });
  addFact(facts, "aeo_angles", seededAnswers.aeo_angles, {
    source: "preflight",
    related_sections: ["faqs", "hero"]
  });
  addFact(facts, "vibe", cleanString5(visualStrategy?.recommended_vibe), {
    source: "preflight",
    related_sections: ["settings"]
  });
  addFact(facts, "image_themes", cleanList4(normalizedStrategy.visual_strategy.preferred_image_themes), {
    source: "preflight",
    related_sections: ["hero", "gallery"]
  });
  addFact(facts, "google_presence_insight", seededAnswers.google_presence_insight, {
    source: "preflight",
    related_sections: ["about", "trustbar"]
  });
  addFact(facts, "next_step_teaser", seededAnswers.next_step_teaser, {
    source: "preflight",
    related_sections: ["hero"]
  });
  addFact(facts, "review_quotes", [], {
    source: "missing",
    requires_client_verification: includesVerificationField(copyPolicy, "review_quotes"),
    related_sections: ["testimonials"]
  });
  addFact(facts, "phone", cleanString5(napRecommendation?.phone), {
    source: cleanString5(napRecommendation?.phone) ? "preflight" : "missing",
    requires_client_verification: includesVerificationField(copyPolicy, "phone"),
    related_sections: ["brand", "contact"]
  });
  addFact(facts, "address", cleanString5(napRecommendation?.address), {
    source: cleanString5(napRecommendation?.address) ? "preflight" : "missing",
    requires_client_verification: includesVerificationField(copyPolicy, "address"),
    related_sections: ["brand", "contact"]
  });
  addFact(facts, "hours", "", {
    source: "missing",
    requires_client_verification: includesVerificationField(copyPolicy, "hours"),
    related_sections: ["contact"]
  });
  addFact(facts, "pricing", "", {
    source: "missing",
    requires_client_verification: includesVerificationField(copyPolicy, "pricing"),
    related_sections: ["investment", "faqs", "contact"]
  });
  addFact(facts, "booking_url", derivePossibleBookingUrl(strategy, reconData), {
    source: derivePossibleBookingUrl(strategy, reconData) ? "preflight" : "missing",
    requires_client_verification: includesVerificationField(copyPolicy, "booking_url"),
    related_sections: ["contact", "settings"]
  });
  addFact(facts, "email", cleanString5(reconData?.client_email), {
    source: cleanString5(reconData?.client_email) ? "preflight" : "missing",
    related_sections: ["brand", "contact"]
  });
  addFact(facts, "founder_story", "", {
    source: "missing",
    related_sections: ["about"]
  });
  addFact(facts, "years_experience", "", {
    source: "missing",
    related_sections: ["about", "trustbar"]
  });
  addFact(facts, "service_list", inferServiceList(seededAnswers, clientPreview), {
    source: hasMeaningfulValue3(inferServiceList(seededAnswers, clientPreview)) ? "inferred" : "missing",
    related_sections: ["features"]
  });
  addFact(facts, "process_summary", "", {
    source: "missing",
    related_sections: ["processSteps"]
  });
  addFact(facts, "surrounding_cities", [], {
    source: "missing",
    related_sections: ["service_area"]
  });
  addFact(facts, "gallery_visual_direction", firstNonEmpty3([
    cleanList4(normalizedStrategy.visual_strategy.preferred_image_themes),
    cleanList4(seededAnswers.recommended_focus)
  ]), {
    source: "preflight",
    related_sections: ["gallery", "hero"]
  });
  hydrateServiceAreaFromPreflight(facts, reconData);
  return facts;
}
__name(buildFactRegistry, "buildFactRegistry");
__name2(buildFactRegistry, "buildFactRegistry");
function hydrateServiceAreaFromPreflight(facts, reconData) {
  const recon = reconPayloadRoot(reconData);
  const ep = safeParseJsonString(recon?.entity_profile_json);
  let areas = cleanList4(recon?.service_area);
  if (isObject4(ep)) {
    areas = [...areas, ...cleanList4(ep.service_area)];
  }
  if (!areas.length) return facts;
  const main = cleanString5(areas[0]);
  if (!main) return facts;
  const cur = facts.service_area_main;
  if (cur && hasMeaningfulValue3(cur.value)) return facts;
  facts.service_area_main = {
    value: main,
    source: "preflight",
    confidence: 0.8,
    verified: false,
    status: "prefilled_unverified",
    related_sections: Array.isArray(cur?.related_sections) ? cur.related_sections : ["service_area", "hero"]
  };
  return facts;
}
__name(hydrateServiceAreaFromPreflight, "hydrateServiceAreaFromPreflight");
__name2(hydrateServiceAreaFromPreflight, "hydrateServiceAreaFromPreflight");
function addFact(registry, key, value, options = {}) {
  registry[key] = {
    value,
    source: options.source || "missing",
    confidence: typeof options.confidence === "number" ? options.confidence : inferConfidence(options.source, value),
    verified: !!options.verified,
    requires_client_verification: !!options.requires_client_verification,
    related_sections: asArray(options.related_sections),
    status: hasMeaningfulValue3(value) ? options.verified ? "verified" : "seeded" : "missing"
  };
}
__name(addFact, "addFact");
__name2(addFact, "addFact");
function hydrateFromPreflight(existingEntry, value) {
  const leaf = extractValue(value);
  if (!hasMeaningfulValue3(leaf)) return existingEntry;
  if (!isObject4(existingEntry)) return existingEntry;
  return {
    ...existingEntry,
    value: leaf,
    source: "preflight",
    confidence: 0.7,
    verified: false,
    status: "prefilled_unverified"
  };
}
__name(hydrateFromPreflight, "hydrateFromPreflight");
__name2(hydrateFromPreflight, "hydrateFromPreflight");
function hydrateFactRegistryWithPreflightIntelligence(facts, pi) {
  if (!isObject4(facts) || !isObject4(pi)) return;
  const positioning = cleanString5(pi.positioning);
  if (facts.business_understanding && positioning) {
    facts.business_understanding = hydrateFromPreflight(facts.business_understanding, positioning);
  }
  const opportunity = cleanString5(pi.opportunity);
  if (facts.opportunity && opportunity) {
    facts.opportunity = hydrateFromPreflight(facts.opportunity, opportunity);
  }
  const diffHyp = cleanString5(pi.differentiation_hypothesis);
  if (facts.differentiation && diffHyp) {
    facts.differentiation = hydrateFromPreflight(facts.differentiation, diffHyp);
  }
  const trustFirst = cleanList4(pi.trust_markers)[0];
  if (facts.trust_signal && trustFirst) {
    facts.trust_signal = hydrateFromPreflight(facts.trust_signal, trustFirst);
  }
  const mergedAeo = uniqueList3([
    ...cleanList4(facts.aeo_angles?.value),
    ...cleanList4(pi.winning_angle ? [pi.winning_angle] : [])
  ]);
  if (facts.aeo_angles && mergedAeo.length) {
    facts.aeo_angles = hydrateFromPreflight(facts.aeo_angles, mergedAeo);
  }
  const mergedFocus = uniqueList3([
    ...cleanList4(facts.recommended_focus?.value),
    ...cleanList4(pi.recommended_focus)
  ]);
  if (facts.recommended_focus && mergedFocus.length) {
    facts.recommended_focus = hydrateFromPreflight(facts.recommended_focus, mergedFocus);
  }
  const webDir = cleanString5(pi.website_direction);
  if (facts.website_direction && webDir) {
    facts.website_direction = hydrateFromPreflight(facts.website_direction, webDir);
  }
  const personaHint = cleanString5(pi.target_persona_hint);
  if (facts.target_persona && !hasMeaningfulValue3(facts.target_persona.value) && personaHint) {
    facts.target_persona = hydrateFromPreflight(facts.target_persona, personaHint);
  }
  const rfForThemes = cleanList4(pi.recommended_focus);
  const existingThemes = cleanList4(facts.image_themes?.value);
  if (facts.image_themes && !existingThemes.length && rfForThemes.length) {
    facts.image_themes = hydrateFromPreflight(facts.image_themes, rfForThemes);
  }
}
__name(hydrateFactRegistryWithPreflightIntelligence, "hydrateFactRegistryWithPreflightIntelligence");
__name2(hydrateFactRegistryWithPreflightIntelligence, "hydrateFactRegistryWithPreflightIntelligence");
function inferConfidence(source, value) {
  if (!hasMeaningfulValue3(value)) return 0;
  if (source === "preflight") return 0.85;
  if (source === "inferred") return 0.65;
  if (source === "user") return 1;
  return 0.5;
}
__name(inferConfidence, "inferConfidence");
__name2(inferConfidence, "inferConfidence");
function includesVerificationField(copyPolicy, name) {
  return cleanList4(copyPolicy?.fields_requiring_verification).includes(name);
}
__name(includesVerificationField, "includesVerificationField");
__name2(includesVerificationField, "includesVerificationField");
function derivePossibleBookingUrl(strategy, reconData) {
  const sourceSnapshot = isObject4(strategy?.source_snapshot) ? strategy.source_snapshot : {};
  return firstNonEmpty3([
    cleanString5(sourceSnapshot?.booking_url),
    cleanString5(reconData?.booking_url),
    cleanString5(strategy?.contact?.booking_url)
  ]);
}
__name(derivePossibleBookingUrl, "derivePossibleBookingUrl");
__name2(derivePossibleBookingUrl, "derivePossibleBookingUrl");
function inferToneOfVoice(strategy, seededAnswers) {
  const vibe = cleanString5(
    strategy?.visual_strategy?.recommended_vibe || seededAnswers?.future_dynamic_vibe_hint
  ).toLowerCase();
  const category = cleanString5(strategy?.business_context?.category).toLowerCase();
  const archetype = cleanString5(strategy?.business_context?.strategic_archetype).toLowerCase();
  if (vibe.includes("luxury")) return "Confident, polished, and premium";
  if (vibe.includes("legacy")) return "Reassuring, credible, and professional";
  if (vibe.includes("solar flare")) return "Bold, energetic, and modern";
  if (archetype.includes("high_consideration")) return "Trust-building, clear, and expert";
  if (category) return `${titleCaseWords(category)}-appropriate, clear, and confident`;
  return "Clear, modern, and trustworthy";
}
__name(inferToneOfVoice, "inferToneOfVoice");
__name2(inferToneOfVoice, "inferToneOfVoice");
function inferServiceList(seededAnswers, clientPreview) {
  const focus = cleanList4(seededAnswers?.recommended_focus);
  const faq = cleanList4(seededAnswers?.faq_angles);
  const offer = cleanString5(seededAnswers?.primary_offer);
  const previewFocus = cleanList4(clientPreview?.recommended_focus);
  const candidates = uniqueList3([...focus, ...previewFocus, ...faq]).filter((item) => {
    const lower = item.toLowerCase();
    return !lower.includes("?") && lower.length <= 60;
  });
  if (candidates.length > 0) return candidates.slice(0, 4);
  if (offer) return [offer];
  return [];
}
__name(inferServiceList, "inferServiceList");
__name2(inferServiceList, "inferServiceList");
function buildBusinessDraft(strategy, reconData, seededAnswers, normalizedStrategy, factRegistry) {
  const businessName = factValue(factRegistry, "business_name");
  const recommendedSections = cleanList4(seededAnswers.recommended_sections);
  const serviceAreas = cleanList4(seededAnswers.service_areas);
  const menu = buildMenu2(normalizedStrategy.schema_toggles);
  const headline = buildHeroHeadline(seededAnswers, normalizedStrategy);
  const subtext = buildHeroSubtext(seededAnswers, normalizedStrategy);
  const heroImageQuery = buildHeroImageQuery3(normalizedStrategy, seededAnswers);
  const galleryImageQuery = buildGalleryImageQuery2(normalizedStrategy, seededAnswers);
  const draft = {
    intelligence: compactObject({
      industry: factValue(factRegistry, "industry"),
      target_persona: factValue(factRegistry, "target_persona"),
      tone_of_voice: factValue(factRegistry, "tone_of_voice")
    }),
    strategy: compactObject({
      ...normalizedStrategy.schema_toggles
    }),
    settings: compactObject({
      vibe: factValue(factRegistry, "vibe") || "",
      menu,
      cta_text: factValue(factRegistry, "cta_text") || "Get Started",
      cta_link: normalizeAnchorLink(factValue(factRegistry, "cta_link") || "#contact"),
      cta_type: inferCtaType2(factValue(factRegistry, "cta_link") || "#contact"),
      secondary_cta_text: buildSecondaryCtaText(normalizedStrategy, seededAnswers),
      secondary_cta_link: buildSecondaryCtaLink(normalizedStrategy)
    }),
    brand: compactObject({
      name: businessName,
      slug: slugify(cleanString5(normalizedStrategy.business_context.slug)) || slugify(businessName),
      tagline: buildTagline(seededAnswers),
      email: factValue(factRegistry, "email"),
      phone: factValue(factRegistry, "phone"),
      office_address: factValue(factRegistry, "address"),
      objection_handle: buildObjectionHandle(normalizedStrategy)
    }),
    hero: compactObject({
      headline,
      subtext,
      image: compactObject({
        alt: buildHeroImageAlt(normalizedStrategy, seededAnswers),
        image_search_query: heroImageQuery
      })
    }),
    about: compactObject({
      story_text: buildAboutStory(seededAnswers),
      founder_note: buildFounderNote(seededAnswers),
      years_experience: factValue(factRegistry, "years_experience")
    }),
    features: buildFeatures(seededAnswers, normalizedStrategy),
    contact: compactObject({
      title: buildContactTitle(normalizedStrategy),
      text: buildContactText(normalizedStrategy, seededAnswers),
      cta_text: factValue(factRegistry, "cta_text") || "Get Started",
      cta_link: normalizeAnchorLink(factValue(factRegistry, "cta_link") || "#contact"),
      email: factValue(factRegistry, "email"),
      phone: factValue(factRegistry, "phone"),
      booking_url: factValue(factRegistry, "booking_url"),
      office_address: factValue(factRegistry, "address")
    })
  };
  if (normalizedStrategy.schema_toggles.show_trustbar) {
    draft.trustbar = {
      enabled: true,
      headline: buildTrustbarHeadline(seededAnswers),
      items: buildTrustbarItems(normalizedStrategy, seededAnswers)
    };
  }
  if (normalizedStrategy.schema_toggles.show_process) {
    draft.processSteps = buildProcessStepsPlaceholder();
  }
  if (normalizedStrategy.schema_toggles.show_testimonials) {
    draft.testimonials = buildTestimonialsPlaceholder(recommendedSections);
  }
  if (normalizedStrategy.schema_toggles.show_faqs) {
    draft.faqs = buildFaqsDraft(normalizedStrategy, seededAnswers);
  }
  if (normalizedStrategy.schema_toggles.show_gallery) {
    draft.gallery = {
      enabled: true,
      title: buildGalleryTitle(normalizedStrategy),
      layout: null,
      show_titles: false,
      strategy: {
        primary_goal: "visual_trust",
        show_gallery: true
      },
      image_source: {
        provider: "search",
        image_search_query: galleryImageQuery,
        filename_pattern: `${slugify(businessName || "client")}-gallery-{index}`,
        target_folder: slugify(businessName || "client")
      }
    };
  }
  if (normalizedStrategy.schema_toggles.show_service_area) {
    draft.service_area = compactObject({
      main_city: serviceAreas[0] || factValue(factRegistry, "service_area_main"),
      surrounding_cities: cleanList4(factValue(factRegistry, "surrounding_cities")),
      travel_note: buildTravelNote(normalizedStrategy),
      cta_text: factValue(factRegistry, "cta_text") || "Check Availability",
      cta_link: normalizeAnchorLink(factValue(factRegistry, "cta_link") || "#contact"),
      map_search_query: buildMapSearchQuery(normalizedStrategy, seededAnswers)
    });
  }
  if (normalizedStrategy.schema_toggles.show_investment) {
    draft.investment = [];
  }
  if (normalizedStrategy.schema_toggles.show_events) {
    draft.events = [];
  }
  if (normalizedStrategy.schema_toggles.show_comparison) {
    draft.comparison = {
      title: "",
      items: []
    };
  }
  return draft;
}
__name(buildBusinessDraft, "buildBusinessDraft");
__name2(buildBusinessDraft, "buildBusinessDraft");
function buildMenu2(toggles) {
  const base = [{ label: "Home", path: "#home" }];
  const conditional = [
    { key: "show_about", label: "About", path: "#about" },
    { key: "show_features", label: "Features", path: "#features" },
    { key: "show_events", label: "Events", path: "#events" },
    { key: "show_process", label: "Process", path: "#process" },
    { key: "show_testimonials", label: "Testimonials", path: "#testimonials" },
    { key: "show_comparison", label: "Comparison", path: "#comparison" },
    { key: "show_gallery", label: "Gallery", path: "#gallery" },
    { key: "show_investment", label: "Investment", path: "#investment" },
    { key: "show_faqs", label: "FAQs", path: "#faqs" },
    { key: "show_service_area", label: "Service Area", path: "#service-area" }
  ];
  for (const item of conditional) {
    if (toggles?.[item.key]) {
      base.push({ label: item.label, path: item.path });
    }
  }
  base.push({ label: "Contact", path: "#contact" });
  return base;
}
__name(buildMenu2, "buildMenu2");
__name2(buildMenu2, "buildMenu");
function normalizeAnchorLink(value) {
  const link = cleanString5(value);
  if (!link) return "#contact";
  if (link.startsWith("http://") || link.startsWith("https://")) return link;
  return link.startsWith("#") ? link : `#${link.replace(/^#/, "")}`;
}
__name(normalizeAnchorLink, "normalizeAnchorLink");
__name2(normalizeAnchorLink, "normalizeAnchorLink");
function inferCtaType2(link) {
  const value = cleanString5(link);
  if (value.startsWith("http://") || value.startsWith("https://")) return "external";
  return "anchor";
}
__name(inferCtaType2, "inferCtaType2");
__name2(inferCtaType2, "inferCtaType");
function buildSecondaryCtaText(normalizedStrategy, seededAnswers) {
  if (normalizedStrategy.schema_toggles.show_gallery) return "View Gallery";
  if (normalizedStrategy.schema_toggles.show_faqs) return "Read FAQs";
  return cleanString5(seededAnswers?.secondary_conversion) ? titleCaseWords(seededAnswers.secondary_conversion.replace(/_/g, " ")) : "";
}
__name(buildSecondaryCtaText, "buildSecondaryCtaText");
__name2(buildSecondaryCtaText, "buildSecondaryCtaText");
function buildSecondaryCtaLink(normalizedStrategy) {
  if (normalizedStrategy.schema_toggles.show_gallery) return "#gallery";
  if (normalizedStrategy.schema_toggles.show_faqs) return "#faqs";
  return "";
}
__name(buildSecondaryCtaLink, "buildSecondaryCtaLink");
__name2(buildSecondaryCtaLink, "buildSecondaryCtaLink");
function buildTagline(seededAnswers) {
  return cleanString5(seededAnswers?.primary_offer) || cleanString5(seededAnswers?.business_understanding) || "";
}
__name(buildTagline, "buildTagline");
__name2(buildTagline, "buildTagline");
function buildObjectionHandle(normalizedStrategy) {
  const objection = firstNonEmpty3([
    cleanList4(normalizedStrategy?.audience_model?.common_objections)
  ]);
  if (!objection) return "";
  return `Built to address common buyer concerns like ${objection}.`;
}
__name(buildObjectionHandle, "buildObjectionHandle");
__name2(buildObjectionHandle, "buildObjectionHandle");
function buildHeroHeadline(seededAnswers, normalizedStrategy) {
  const offer = cleanString5(seededAnswers?.primary_offer);
  const audience = cleanString5(seededAnswers?.audience);
  const businessName = cleanString5(seededAnswers?.business_name);
  if (offer) return offer;
  if (audience && businessName) return `${businessName} for ${audience}`;
  if (businessName) return `A Better Website Direction for ${businessName}`;
  return `A Clearer, Higher-Converting Presence`;
}
__name(buildHeroHeadline, "buildHeroHeadline");
__name2(buildHeroHeadline, "buildHeroHeadline");
function buildHeroSubtext(seededAnswers, normalizedStrategy) {
  const direction = cleanString5(seededAnswers?.website_direction);
  const opportunity = cleanString5(seededAnswers?.opportunity);
  const audience = cleanString5(seededAnswers?.audience);
  if (direction) return direction;
  if (opportunity) return opportunity;
  if (audience) return `Designed to connect with ${audience} and make the next step feel clear.`;
  return `We\u2019ll refine the story, proof, and conversion path so the site feels premium and easy to act on.`;
}
__name(buildHeroSubtext, "buildHeroSubtext");
__name2(buildHeroSubtext, "buildHeroSubtext");
function buildHeroImageAlt(normalizedStrategy, seededAnswers) {
  const category = cleanString5(normalizedStrategy?.business_context?.category);
  const mainCity = cleanString5(seededAnswers?.service_area);
  const businessName = cleanString5(seededAnswers?.business_name);
  return firstNonEmpty3([
    businessName && category ? `${businessName} ${category} hero image` : "",
    category && mainCity ? `${category} in ${mainCity}` : "",
    category ? `${category} website hero image` : "",
    "Business website hero image"
  ]);
}
__name(buildHeroImageAlt, "buildHeroImageAlt");
__name2(buildHeroImageAlt, "buildHeroImageAlt");
function buildHeroImageQuery3(normalizedStrategy, seededAnswers) {
  const candidates = uniqueList3([
    ...cleanList4(normalizedStrategy?.visual_strategy?.preferred_image_themes),
    cleanString5(seededAnswers?.primary_offer),
    cleanString5(normalizedStrategy?.business_context?.category),
    cleanString5(seededAnswers?.future_dynamic_vibe_hint)
  ]);
  return candidates.find((item) => item.length >= 4) || "professional business lifestyle";
}
__name(buildHeroImageQuery3, "buildHeroImageQuery3");
__name2(buildHeroImageQuery3, "buildHeroImageQuery");
function buildGalleryImageQuery2(normalizedStrategy, seededAnswers) {
  const candidates = uniqueList3([
    cleanString5(seededAnswers?.primary_offer),
    ...cleanList4(normalizedStrategy?.visual_strategy?.preferred_image_themes),
    ...cleanList4(seededAnswers?.recommended_focus),
    cleanString5(normalizedStrategy?.business_context?.category)
  ]);
  return candidates.find((item) => item.length >= 4) || "business portfolio lifestyle";
}
__name(buildGalleryImageQuery2, "buildGalleryImageQuery2");
__name2(buildGalleryImageQuery2, "buildGalleryImageQuery");
function buildAboutStory(seededAnswers) {
  return firstNonEmpty3([
    cleanString5(seededAnswers?.business_understanding),
    cleanString5(seededAnswers?.website_direction),
    cleanString5(seededAnswers?.opportunity)
  ]);
}
__name(buildAboutStory, "buildAboutStory");
__name2(buildAboutStory, "buildAboutStory");
function buildFounderNote(seededAnswers) {
  const trust = cleanString5(seededAnswers?.trust_signal);
  if (!trust) return "";
  return `The site should reinforce trust through ${trust}.`;
}
__name(buildFounderNote, "buildFounderNote");
__name2(buildFounderNote, "buildFounderNote");
function buildFeatures(seededAnswers, normalizedStrategy) {
  const focus = uniqueList3([
    ...cleanList4(seededAnswers?.recommended_focus),
    ...cleanList4(normalizedStrategy?.audience_model?.decision_factors),
    ...cleanList4(seededAnswers?.faq_angles)
  ]).filter((item) => !item.includes("?"));
  if (focus.length === 0 && cleanString5(seededAnswers?.primary_offer)) {
    return [
      {
        title: "Core Offer",
        description: cleanString5(seededAnswers.primary_offer),
        icon_slug: "sparkles"
      }
    ];
  }
  return focus.slice(0, 4).map((item, index) => ({
    title: featureTitleFromText(item, index),
    description: featureDescriptionFromText(item, seededAnswers),
    icon_slug: pickIcon(index)
  }));
}
__name(buildFeatures, "buildFeatures");
__name2(buildFeatures, "buildFeatures");
function featureTitleFromText(text, index) {
  const cleaned = cleanString5(text);
  if (!cleaned) return `Feature ${index + 1}`;
  if (cleaned.length <= 36) return cleaned;
  const words = cleaned.split(/\s+/).slice(0, 4);
  return titleCaseWords(words.join(" "));
}
__name(featureTitleFromText, "featureTitleFromText");
__name2(featureTitleFromText, "featureTitleFromText");
function featureDescriptionFromText(text, seededAnswers) {
  const cleaned = cleanString5(text);
  if (!cleaned) return cleanString5(seededAnswers?.website_direction) || "";
  if (cleaned.length >= 50) return cleaned;
  return `${cleaned} presented in a way that makes the value clearer to the right buyer.`;
}
__name(featureDescriptionFromText, "featureDescriptionFromText");
__name2(featureDescriptionFromText, "featureDescriptionFromText");
function pickIcon(index) {
  const icons = ["sparkles", "shield", "star", "check", "briefcase", "clock"];
  return icons[index % icons.length];
}
__name(pickIcon, "pickIcon");
__name2(pickIcon, "pickIcon");
function buildContactTitle(normalizedStrategy) {
  const mode = cleanString5(
    normalizedStrategy?.conversion_strategy?.primary_conversion || normalizedStrategy?.conversion_strategy?.conversion_mode
  ).toLowerCase();
  if (mode.includes("quote")) return "Request a Quote";
  if (mode.includes("book")) return "Book the Next Step";
  if (mode.includes("call")) return "Start the Conversation";
  return "Take the Next Step";
}
__name(buildContactTitle, "buildContactTitle");
__name2(buildContactTitle, "buildContactTitle");
function buildContactText(normalizedStrategy, seededAnswers) {
  return firstNonEmpty3([
    cleanString5(seededAnswers?.next_step_teaser),
    cleanString5(seededAnswers?.website_direction),
    "Tell us a little about what you need and we\u2019ll point you in the right direction."
  ]);
}
__name(buildContactText, "buildContactText");
__name2(buildContactText, "buildContactText");
function buildTrustbarHeadline(seededAnswers) {
  return cleanString5(seededAnswers?.trust_signal) ? `Built Around ${titleCaseWords(seededAnswers.trust_signal)}` : "Why Visitors Can Feel Confident";
}
__name(buildTrustbarHeadline, "buildTrustbarHeadline");
__name2(buildTrustbarHeadline, "buildTrustbarHeadline");
function buildTrustbarItems(normalizedStrategy, seededAnswers) {
  const items = uniqueList3([
    ...cleanList4(normalizedStrategy?.proof_model?.trust_signals),
    ...cleanList4(normalizedStrategy?.proof_model?.credibility_sources)
  ]).slice(0, 4);
  if (items.length === 0 && cleanString5(seededAnswers?.trust_signal)) {
    items.push(cleanString5(seededAnswers.trust_signal));
  }
  return items.slice(0, 4).map((label, index) => ({
    icon: pickIcon(index),
    label: titleCaseWords(label.replace(/_/g, " ")),
    sublabel: ""
  }));
}
__name(buildTrustbarItems, "buildTrustbarItems");
__name2(buildTrustbarItems, "buildTrustbarItems");
function buildFaqsDraft(normalizedStrategy, seededAnswers) {
  return uniqueList3([
    ...cleanList4(normalizedStrategy?.site_structure?.faq_angles),
    ...cleanList4(seededAnswers?.faq_angles)
  ]).slice(0, 5).map((question) => ({
    question,
    answer: ""
  }));
}
__name(buildFaqsDraft, "buildFaqsDraft");
__name2(buildFaqsDraft, "buildFaqsDraft");
function buildGalleryTitle(normalizedStrategy) {
  const category = cleanString5(normalizedStrategy?.business_context?.category);
  if (category) return `${titleCaseWords(category)} Highlights`;
  return "Featured Work";
}
__name(buildGalleryTitle, "buildGalleryTitle");
__name2(buildGalleryTitle, "buildGalleryTitle");
function buildTravelNote(normalizedStrategy) {
  const model = cleanString5(normalizedStrategy?.business_context?.business_model).toLowerCase();
  if (model.includes("service_area")) {
    return "Outside these areas? Reach out and we can confirm fit based on your location.";
  }
  return "";
}
__name(buildTravelNote, "buildTravelNote");
__name2(buildTravelNote, "buildTravelNote");
function buildMapSearchQuery(normalizedStrategy, seededAnswers) {
  const offer = cleanString5(seededAnswers?.primary_offer);
  const area = cleanString5(seededAnswers?.service_area);
  if (offer && area) return `${offer} near ${area}`;
  return area || "";
}
__name(buildMapSearchQuery, "buildMapSearchQuery");
__name2(buildMapSearchQuery, "buildMapSearchQuery");
function buildProcessStepsPlaceholder() {
  return [];
}
__name(buildProcessStepsPlaceholder, "buildProcessStepsPlaceholder");
__name2(buildProcessStepsPlaceholder, "buildProcessStepsPlaceholder");
function buildTestimonialsPlaceholder(recommendedSections) {
  if (!cleanList4(recommendedSections).some(
    (item) => item.toLowerCase().includes("testimonial") || item.toLowerCase().includes("review")
  )) {
    return [];
  }
  return [];
}
__name(buildTestimonialsPlaceholder, "buildTestimonialsPlaceholder");
__name2(buildTestimonialsPlaceholder, "buildTestimonialsPlaceholder");
function computeSectionStatus2(strategy, factRegistry, businessDraft) {
  const requirements = getSectionRequirements(strategy);
  const status = {};
  for (const [section, config] of Object.entries(requirements)) {
    const enabled = config.required || !!strategy?.schema_toggles?.[config.toggle_key];
    const missing_fields = [];
    const weak_fields = [];
    const ready_fields = [];
    if (!enabled) {
      status[section] = {
        enabled: false,
        status: "disabled",
        required_for_preview: false,
        fields_needed: [],
        weak_fields: [],
        ready_fields: []
      };
      continue;
    }
    for (const field of config.fields) {
      const value = readPath(businessDraft, field.path);
      if (!hasMeaningfulValue3(value)) {
        missing_fields.push(field.path);
        continue;
      }
      if (field.requires_verification && !isFactVerifiedByPath(factRegistry, field.fact_key)) {
        weak_fields.push(field.path);
        continue;
      }
      ready_fields.push(field.path);
    }
    let state = "ready";
    if (missing_fields.length > 0) state = "missing";
    else if (weak_fields.length > 0) state = "partial";
    status[section] = {
      enabled: true,
      status: state,
      required_for_preview: !!config.required_for_preview,
      fields_needed: missing_fields,
      weak_fields,
      ready_fields
    };
  }
  return status;
}
__name(computeSectionStatus2, "computeSectionStatus2");
__name2(computeSectionStatus2, "computeSectionStatus");
function getSectionRequirements(strategy) {
  const copyPolicy = strategy?.copy_policy || {};
  return {
    intelligence: {
      required: true,
      required_for_preview: true,
      toggle_key: null,
      fields: [
        { path: "intelligence.industry", fact_key: "industry" },
        { path: "intelligence.target_persona", fact_key: "target_persona" },
        { path: "intelligence.tone_of_voice", fact_key: "tone_of_voice" }
      ]
    },
    strategy: {
      required: true,
      required_for_preview: true,
      toggle_key: null,
      fields: [{ path: "strategy.show_features" }]
    },
    settings: {
      required: true,
      required_for_preview: true,
      toggle_key: null,
      fields: [
        { path: "settings.vibe", fact_key: "vibe" },
        { path: "settings.cta_text", fact_key: "cta_text" },
        { path: "settings.cta_link", fact_key: "cta_link" }
      ]
    },
    brand: {
      required: true,
      required_for_preview: true,
      toggle_key: null,
      fields: [
        { path: "brand.name", fact_key: "business_name" },
        { path: "brand.tagline", fact_key: "primary_offer" }
      ]
    },
    hero: {
      required: true,
      required_for_preview: true,
      toggle_key: null,
      fields: [
        { path: "hero.headline", fact_key: "primary_offer" },
        { path: "hero.subtext", fact_key: "website_direction" },
        { path: "hero.image.alt", fact_key: "primary_offer" },
        { path: "hero.image.image_search_query", fact_key: "image_themes" }
      ]
    },
    about: {
      required: true,
      required_for_preview: false,
      toggle_key: "show_about",
      fields: [
        { path: "about.story_text", fact_key: "business_understanding" },
        { path: "about.founder_note", fact_key: "trust_signal" },
        {
          path: "about.years_experience",
          fact_key: "years_experience",
          requires_verification: includesVerificationField(copyPolicy, "years_experience")
        }
      ]
    },
    features: {
      required: true,
      required_for_preview: true,
      toggle_key: "show_features",
      fields: [{ path: "features", fact_key: "service_list" }]
    },
    contact: {
      required: true,
      required_for_preview: true,
      toggle_key: null,
      fields: [
        { path: "contact.cta_text", fact_key: "cta_text" },
        { path: "contact.cta_link", fact_key: "cta_link" }
      ]
    },
    trustbar: {
      required: false,
      required_for_preview: false,
      toggle_key: "show_trustbar",
      fields: [{ path: "trustbar.items", fact_key: "trust_signal" }]
    },
    processSteps: {
      required: false,
      required_for_preview: false,
      toggle_key: "show_process",
      fields: [{ path: "processSteps", fact_key: "process_summary" }]
    },
    testimonials: {
      required: false,
      required_for_preview: false,
      toggle_key: "show_testimonials",
      fields: [
        { path: "testimonials", fact_key: "review_quotes", requires_verification: true }
      ]
    },
    faqs: {
      required: false,
      required_for_preview: false,
      toggle_key: "show_faqs",
      fields: [{ path: "faqs", fact_key: "faq_angles" }]
    },
    gallery: {
      required: false,
      required_for_preview: false,
      toggle_key: "show_gallery",
      fields: [
        {
          path: "gallery.image_source.image_search_query",
          fact_key: "gallery_visual_direction"
        }
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
        { path: "investment", fact_key: "pricing", requires_verification: true }
      ]
    },
    events: {
      required: false,
      required_for_preview: false,
      toggle_key: "show_events",
      fields: [{ path: "events", fact_key: "events" }]
    },
    comparison: {
      required: false,
      required_for_preview: false,
      toggle_key: "show_comparison",
      fields: [{ path: "comparison.items", fact_key: "comparison" }]
    }
  };
}
__name(getSectionRequirements, "getSectionRequirements");
__name2(getSectionRequirements, "getSectionRequirements");
function readPath(obj, path) {
  const parts = cleanString5(path).split(".").filter(Boolean);
  let current = obj;
  for (const part of parts) {
    if (!isObject4(current) && !Array.isArray(current)) return void 0;
    current = current?.[part];
  }
  return current;
}
__name(readPath, "readPath");
__name2(readPath, "readPath");
function factValue(factRegistry, key) {
  return factRegistry?.[key]?.value;
}
__name(factValue, "factValue");
__name2(factValue, "factValue");
function isFactVerifiedByPath(factRegistry, factKey) {
  if (!factKey) return false;
  const fact = factRegistry?.[factKey];
  return !!fact?.verified || !fact?.requires_client_verification;
}
__name(isFactVerifiedByPath, "isFactVerifiedByPath");
__name2(isFactVerifiedByPath, "isFactVerifiedByPath");
function renderFieldScopedQuestion(plan, state = {}) {
  const pf = cleanString5(plan?.primary_field);
  const businessModel = cleanString5(state?.blueprint?.strategy?.business_context?.business_model) || "general";
  switch (pf) {
    case "differentiation": {
      const rf = cleanList4(state?.preflight_intelligence?.recommended_focus);
      const rawHint = rf.length ? cleanString5(rf[0]) : "";
      const focusHint = rawHint.length > 100 ? `${rawHint.slice(0, 97)}\u2026` : rawHint;
      if (focusHint) {
        return `What makes your business different from others offering similar services \u2014 what do customers specifically choose you for, especially around ${focusHint}?`;
      }
      return "What makes your business different from others offering similar services \u2014 what do customers specifically choose you for?";
    }
    case "target_persona":
      return "Who do you do your best work for \u2014 what kind of customer gets the most value from what you offer?";
    case "primary_offer":
      return "What is the main service or outcome you provide \u2014 what are customers really coming to you for?";
    case "booking_method":
      if (businessModel === "local_service" || businessModel === "storefront") {
        return "When someone is interested in working with you, what usually happens next \u2014 do they call, visit, request a quote, or something else?";
      }
      if (businessModel === "saas" || businessModel === "digital_product") {
        return "How do people typically get started \u2014 do they sign up, book a demo, or go through a sales process?";
      }
      return "When someone is ready to move forward, what is the typical next step they take?";
    case "contact_path":
      return "What is the best way for someone to reach out if they have questions or want to get started?";
    case "email":
      return "What email should be used for customer inquiries or project requests?";
    case "phone":
      return "What phone number should customers call if they want to reach you directly?";
    case "service_area_list":
      return "What areas or locations do you primarily serve?";
    case "gallery_visual_direction":
      return "What kind of visuals best represent your work \u2014 finished projects, behind-the-scenes craftsmanship, or something else?";
    default:
      return null;
  }
}
__name(renderFieldScopedQuestion, "renderFieldScopedQuestion");
__name2(renderFieldScopedQuestion, "renderFieldScopedQuestion");
function renderQuestion(questionPlan, blueprint, state = {}) {
  if (!questionPlan) return "";
  const scoped = renderFieldScopedQuestion(questionPlan, state);
  const blue = state && typeof state === "object" && isObject4(state.blueprint) ? state.blueprint : blueprint;
  const followup = cleanString5(blue?.followup_hint);
  if (scoped && followup) {
    if (blue && Object.prototype.hasOwnProperty.call(blue, "followup_hint")) {
      delete blue.followup_hint;
    }
    return `${scoped} ${followup}`;
  }
  if (scoped) {
    return scoped;
  }
  const businessName = cleanString5(blueprint?.strategy?.business_context?.business_name) || "your business";
  const category = cleanString5(blueprint?.strategy?.business_context?.category);
  const conversionMode = cleanString5(
    blueprint?.strategy?.conversion_strategy?.conversion_mode || blueprint?.strategy?.conversion_strategy?.primary_conversion
  );
  const renderers = {
    positioning() {
      return `I reviewed the preflight direction for ${businessName}. To sharpen the page around the right message, who is the ideal fit, what are they usually coming to you for, and what makes your approach the better choice?`;
    },
    conversion() {
      return `When someone is ready to move forward with ${businessName}, how do they typically take the next step \u2014 do they call, request a quote, use a form, book online, or something else?`;
    },
    service_area() {
      return `What is the main city or region you want the site to lead with, and what nearby areas should visitors know you also serve?`;
    },
    proof() {
      return `What should make someone feel confident choosing ${businessName} right away\u2014reviews, years of experience, credentials, notable results, guarantees, or something else?`;
    },
    brand_story() {
      return `How did ${businessName} start, and what should the site help people understand about your standards, philosophy, or the way you work?`;
    },
    process() {
      return `When someone decides to work with ${businessName}, what does the journey typically look like\u2014from the first conversation to the outcome you're helping them reach?`;
    },
    visual_direction() {
      return `What kinds of images or examples should the site show most, and what overall vibe should those visuals create for the right visitor?`;
    },
    contact_details() {
      return `To make the site publish-ready, what contact details should we treat as accurate right now\u2014email, phone, address, hours, or anything that should stay private for now?`;
    },
    pricing() {
      return `Do you offer standardized pricing or packages, or is the best way to frame pricing as custom, quote-based, or starting at a certain level?`;
    }
  };
  if (renderers[questionPlan.bundle_id]) {
    return renderers[questionPlan.bundle_id]();
  }
  const categoryLine = category ? ` for ${category}` : "";
  const conversionLine = conversionMode ? ` and the main next step should support ${conversionMode.replace(/_/g, " ")}` : "";
  return `I reviewed the preflight direction for ${businessName}${categoryLine}. What feels most important to clarify first so the site reflects the business well${conversionLine}?`;
}
__name(renderQuestion, "renderQuestion");
__name2(renderQuestion, "renderQuestion");
function fallbackOpeningMessage(state) {
  const businessName = cleanString5(state?.businessName) || "your business";
  return `I reviewed the preflight direction for ${businessName}. Let\u2019s verify the most important details so the preview feels premium, accurate, and conversion-ready.`;
}
__name(fallbackOpeningMessage, "fallbackOpeningMessage");
__name2(fallbackOpeningMessage, "fallbackOpeningMessage");
function evaluateBlueprintReadiness2(blueprint) {
  const sectionStatus = isObject4(blueprint?.section_status) ? blueprint.section_status : {};
  const enabledSections = Object.entries(sectionStatus).filter(([, value]) => value?.enabled);
  const requiredPreviewSections = enabledSections.filter(([, value]) => value?.required_for_preview);
  const readyRequiredCount = requiredPreviewSections.filter(([, value]) => value?.status === "ready").length;
  const totalRequiredCount = requiredPreviewSections.length || 1;
  const score = Number((readyRequiredCount / totalRequiredCount).toFixed(2));
  const blockingSections = requiredPreviewSections.filter(([, value]) => value?.status !== "ready").map(([key]) => key);
  const queue = Array.isArray(blueprint?.verification_queue) ? blueprint.verification_queue : [];
  const mustVerifyOpen = queue.filter((item) => item.priority >= 85).map((item) => item.field_key);
  return {
    score,
    can_generate_now: blockingSections.length === 0 && mustVerifyOpen.length === 0,
    remaining_blocks: blockingSections,
    satisfied_blocks: requiredPreviewSections.filter(([, value]) => value?.status === "ready").map(([key]) => key),
    must_verify_open: mustVerifyOpen
  };
}
__name(evaluateBlueprintReadiness2, "evaluateBlueprintReadiness2");
__name2(evaluateBlueprintReadiness2, "evaluateBlueprintReadiness");
async function onRequestGet4({ request, env }) {
  try {
    const url = new URL(request.url);
    const slug = (url.searchParams.get("slug") || "").trim();
    if (!slug) {
      return json5({ ok: false, error: "Missing slug" }, 400);
    }
    const base = env.APPS_SCRIPT_STATUS_URL;
    if (!base) {
      throw new Error("Missing APPS_SCRIPT_STATUS_URL env var");
    }
    const upstreamUrl = `${base}?slug=${encodeURIComponent(slug)}`;
    const res = await fetch(upstreamUrl, {
      method: "GET",
      headers: { "Accept": "application/json" }
    });
    const text = await res.text();
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch {
      throw new Error(`Status upstream returned non-JSON: ${text}`);
    }
    return new Response(JSON.stringify(parsed), {
      status: res.ok ? 200 : res.status,
      headers: { "content-type": "application/json; charset=utf-8" }
    });
  } catch (err) {
    return json5({ ok: false, error: String(err?.message || err) }, 500);
  }
}
__name(onRequestGet4, "onRequestGet4");
__name2(onRequestGet4, "onRequestGet");
function json5(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" }
  });
}
__name(json5, "json5");
__name2(json5, "json");
function json6(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store"
    }
  });
}
__name(json6, "json6");
__name2(json6, "json");
function extractJsonObject(text) {
  const raw = String(text || "").trim();
  if (!raw) {
    throw new Error("AI returned empty content");
  }
  try {
    return JSON.parse(raw);
  } catch {
  }
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    throw new Error("AI did not return valid JSON");
  }
  return JSON.parse(raw.slice(start, end + 1));
}
__name(extractJsonObject, "extractJsonObject");
__name2(extractJsonObject, "extractJsonObject");
function coerceGbpWhenWebsitePresent(parsed, websiteHint) {
  const w = String(websiteHint || "").trim();
  if (!/^https?:\/\//i.test(w)) return;
  if (parsed.gbp_status !== "not_found") return;
  parsed.gbp_status = "unclear";
  const note = "Automated inference only: a website URL was provided; a GBP may exist or need claiming\u2014live Maps verification was not performed.";
  parsed.notes = [parsed.notes, note].filter(Boolean).join(" ");
  const c = Number(parsed.listing_confidence);
  parsed.listing_confidence = Number.isFinite(c) ? Math.max(c, 0.38) : 0.4;
}
__name(coerceGbpWhenWebsitePresent, "coerceGbpWhenWebsitePresent");
__name2(coerceGbpWhenWebsitePresent, "coerceGbpWhenWebsitePresent");
async function onRequest(context) {
  const { request, env } = context;
  if (request.method !== "POST") {
    return json6({ ok: false, error: "Use POST /api/preflight-gbp" }, 405);
  }
  try {
    const body = await request.json();
    const slug = String(body.slug || "").trim();
    if (!slug) {
      return json6({ ok: false, error: "Missing slug" }, 400);
    }
    if (!env.APPS_SCRIPT_WEBAPP_URL) {
      throw new Error("Missing APPS_SCRIPT_WEBAPP_URL env var");
    }
    if (!env.FACTORY_KEY) {
      throw new Error("Missing FACTORY_KEY env var");
    }
    if (!env.OPENAI_API_KEY) {
      throw new Error("Missing OPENAI_API_KEY env var");
    }
    const statusRes = await fetch(new URL("/api/preflight-status", request.url), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ slug })
    });
    const status = await statusRes.json();
    if (!statusRes.ok || !status.ok) {
      return json6(
        {
          ok: false,
          error: status?.error || "Failed to load preflight status",
          slug
        },
        statusRes.status || 404
      );
    }
    const websiteHint = String(
      status.optional_website_or_social ?? status.client?.optional_website_or_social ?? status.website_or_social ?? ""
    ).trim();
    const prompt = `
You are the SiteForge Factory GBP Recon Engine.

Your job:
Create a first-pass Google Business Profile audit or setup recommendation for a local business.

Important:
- Do NOT pretend you verified a live Google Maps listing. You are inferring from inputs only; say so in "notes" when relevant.
- Do NOT claim a specific Maps URL or review count unless the input explicitly provides it.
- In this v1 flow, you infer likely GBP posture from name, location, description, and optional website.
- Focus on local SEO, category fit, NAP consistency, business model alignment, and setup recommendations.
- Be practical, category-aware, and specific.

WEBSITE / DOMAIN SIGNAL (critical):
- If a real http(s) website URL is provided below for this business, treat it as evidence the business likely has or could claim a legitimate online footprint\u2014including a GBP that may exist under a slightly different name or that needs claiming/merging.
- In that case you MUST NOT use gbp_status "not_found". Prefer "unclear" or "likely_exists" with honest low-to-mid listing_confidence, and explain in "notes" that live Maps verification was not performed.
- Reserve "not_found" for cases with no website AND no strong basis to believe a listing exists (e.g. brand-new entity, incomplete info only).

Business name:
${status.input_business_name}

Location / service area:
${status.city_or_service_area_input}

Business description:
${status.description_input}

Website / social (optional):
${websiteHint || "(none provided)"}

Return ONLY valid JSON in this exact structure:

{
  "gbp_status": "",
  "listing_found": false,
  "listing_confidence": 0,
  "recommended_primary_category": "",
  "recommended_secondary_categories": [],
  "recommended_business_model": "",
  "nap_recommendation": {
    "name": "",
    "phone": "",
    "address": "",
    "service_area": []
  },
  "required_inputs_for_setup": [],
  "improvement_opportunities": [],
  "notes": ""
}

Rules:
- "gbp_status" must be one of:
  "likely_exists", "unclear", "not_found"
- "listing_found" must be boolean (true only if the input gives explicit evidence; a website alone is not proof of a claimed GBP)
- "listing_confidence" must be a number from 0 to 1
- If "gbp_status" is "unclear", do NOT use 0 confidence unless there is truly no basis at all
- If a website URL is provided, "not_found" is almost always wrong\u2014use "unclear" or "likely_exists" instead
- "recommended_primary_category" must be a real-world GBP-style category, not a business model
- "recommended_business_model" must be one of:
  "service_area", "storefront", "hybrid", "destination", "online"
- "nap_recommendation.name" should be the best public-facing business name
- Leave unknown fields like phone or address as empty strings rather than inventing specifics

BUSINESS MODEL GUIDANCE
- Use "service_area" when the business primarily travels to the customer
- Use "storefront" when customers primarily come to a fixed public location
- Use "hybrid" when both are meaningfully true
- Use "destination" when the experience happens at a launch point, venue, marina, dock, studio, or attraction area
- For tours, charters, excursions, and destination-based activities, strongly prefer "destination"

CATEGORY GUIDANCE
- Categories should sound like real GBP categories
- Good examples:
  "Boat Tour Agency"
  "Tour Operator"
  "Electrician"
  "Roofing Contractor"
- Do not use business-model words as categories

SETUP INPUT GUIDANCE
- "required_inputs_for_setup" should list the most important information needed to create or improve the GBP
- Prefer category-relevant setup needs
- For tours and destination experiences, likely inputs include:
  public business phone number, departure location, booking URL, hours, description, photos

IMPROVEMENT OPPORTUNITIES GUIDANCE
- Keep these concise and GBP-specific
- Focus on category alignment, location clarity, booking readiness, reviews, photos, and description quality
- Avoid generic advice that could apply to any business

NOTES GUIDANCE
- "notes" should be a short strategic observation about GBP/entity setup
- Avoid broad marketing language like "focus on local SEO"
- Prefer specific observations about category, location, destination intent, or booking behavior

Return JSON only. No markdown. No commentary.
`;
    const aiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.OPENAI_API_KEY}`,
        "content-type": "application/json"
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0.2,
        messages: [
          {
            role: "system",
            content: "You return only valid JSON. No markdown. No commentary."
          },
          {
            role: "user",
            content: prompt
          }
        ]
      })
    });
    const aiJson = await aiRes.json();
    if (!aiRes.ok) {
      return json6(
        {
          ok: false,
          error: aiJson?.error?.message || "OpenAI request failed"
        },
        502
      );
    }
    const content = aiJson?.choices?.[0]?.message?.content || "";
    const parsed = extractJsonObject(content);
    coerceGbpWhenWebsitePresent(parsed, websiteHint);
    const appsScriptPayload = {
      route: "preflight_gbp",
      factory_key: env.FACTORY_KEY,
      slug,
      gbp_audit: parsed || {}
    };
    const persistRes = await fetch(env.APPS_SCRIPT_WEBAPP_URL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(appsScriptPayload)
    });
    const persistText = await persistRes.text();
    return new Response(persistText, {
      status: persistRes.status,
      headers: { "content-type": "application/json; charset=utf-8" }
    });
  } catch (err) {
    return json6(
      {
        ok: false,
        error: String(err?.message || err)
      },
      500
    );
  }
}
__name(onRequest, "onRequest");
__name2(onRequest, "onRequest");
function json7(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store"
    }
  });
}
__name(json7, "json7");
__name2(json7, "json");
function extractJsonObject2(text) {
  const raw = String(text || "").trim();
  if (!raw) {
    throw new Error("AI returned empty content");
  }
  try {
    return JSON.parse(raw);
  } catch {
  }
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    throw new Error("AI did not return valid JSON");
  }
  return JSON.parse(raw.slice(start, end + 1));
}
__name(extractJsonObject2, "extractJsonObject2");
__name2(extractJsonObject2, "extractJsonObject");
function getRecordFields(status) {
  const website = String(
    status.optional_website_or_social ?? status.client?.optional_website_or_social ?? status.website_or_social ?? ""
  ).trim();
  return {
    input_business_name: String(
      status.input_business_name ?? status.client?.input_business_name ?? ""
    ).trim(),
    city_or_service_area_input: String(
      status.city_or_service_area_input ?? status.client?.city_or_service_area_input ?? ""
    ).trim(),
    description_input: String(
      status.description_input ?? status.client?.description_input ?? ""
    ).trim(),
    website,
    competitive_intelligence: status.competitive_intelligence || {},
    client_preview: status.client_preview || {},
    entity_profile: status.entity_profile || {},
    gbp_audit: status.gbp_audit || {}
  };
}
__name(getRecordFields, "getRecordFields");
__name2(getRecordFields, "getRecordFields");
function postProcessGoogleInsight(rawInsight, website, gbp) {
  const hasSite = /^https?:\/\//i.test(String(website || "").trim());
  const gs = String(gbp?.gbp_status ?? "").trim();
  if (hasSite && gs === "not_found") {
    return "A website is on file for this business. This automated pass did not verify a live Google Business Profile in Maps\u2014a listing may exist under a slightly different name or still need to be claimed and aligned with this domain.";
  }
  if (hasSite && (gs === "unclear" || gs === "likely_exists") && /does not appear to have a fully established Google Business presence/i.test(
    String(rawInsight || "")
  )) {
    return "You have a public web presence; a Google Business Profile may already exist or should be claimed so Maps and your site tell the same story for local discovery.";
  }
  return String(rawInsight || "").trim();
}
__name(postProcessGoogleInsight, "postProcessGoogleInsight");
__name2(postProcessGoogleInsight, "postProcessGoogleInsight");
async function onRequest2(context) {
  const { request, env } = context;
  if (request.method !== "GET") {
    return json7({ ok: false, error: "Use GET /api/preflight-preview?slug=..." }, 405);
  }
  try {
    const url = new URL(request.url);
    const slug = url.searchParams.get("slug");
    if (!slug) {
      return json7({ ok: false, error: "Missing slug" }, 400);
    }
    if (!env.OPENAI_API_KEY) {
      return json7({ ok: false, error: "Missing OPENAI_API_KEY env var" }, 500);
    }
    const statusRes = await fetch(new URL("/api/preflight-status", request.url), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ slug })
    });
    const status = await statusRes.json();
    if (!statusRes.ok || !status.ok) {
      return json7(
        {
          ok: false,
          error: status?.error || "Failed to load preflight status",
          slug
        },
        statusRes.status >= 400 ? statusRes.status : 404
      );
    }
    const f = getRecordFields(status);
    const prompt = `
You write the client-facing preflight PREVIEW for SiteForge (before paid intake). Return JSON only.

PRIMARY INPUT \u2014 competitive_intelligence from recon (must drive differentiation in every paragraph):
${JSON.stringify(f.competitive_intelligence, null, 2)}

Supporting context \u2014 entity_profile:
${JSON.stringify(f.entity_profile, null, 2)}

Prior recon client_preview (optional; refine, do not copy verbatim):
${JSON.stringify(f.client_preview, null, 2)}

gbp_audit (for google_presence_insight tone only):
${JSON.stringify(f.gbp_audit, null, 2)}

Business
- name: ${f.input_business_name}
- location: ${f.city_or_service_area_input}
- description: ${f.description_input}
- website: ${f.website || "(none)"}

ABSOLUTE RULES
1. Do NOT summarize the description in generic marketing language. ANALYZE: who loses if this business wins, what buyers compare, why someone would pick them vs a chain / online-only / commodity option \u2014 use competitive_intelligence fields explicitly when present; if empty, infer from name + category.
2. FORBIDDEN without concrete tie-in: "local gem", "passionate", "streamlined single-page", "visually engaging", "enhance visibility", "drive foot traffic", "unique offerings", "connect with you", "art enthusiasts" as empty fluff.
3. business_understanding: at most 2 sentences; must include at least one contrast vs a plausible alternative (e.g. big-box framing, online-only, mobile-only, commodity).
4. opportunity: 1\u20132 sentences; a specific strategic leverage (proof gap, trust gap, category confusion, craft vs price) \u2014 not "grow your business".
5. website_direction: 1 sentence; what the page must prove or make easy (no generic "showcase portfolio" alone).
6. recommended_focus: 3\u20135 strings; each specific to THIS business model and inputs (e.g. artist-owned craft, custom vs ready-made, gallery trust) \u2014 not generic "testimonials" unless paired with a reason.
7. google_presence_insight: short; reflect gbp_audit.gbp_status. Never claim we scraped Google Maps. If gbp_status is not_found but a website URL is listed above, say automated verification was not performed and next step is to check/claim GBP \u2014 do NOT say they have "no" web presence.
8. next_step: one sentence teaser for the paid phase.

Return ONLY this JSON shape:
{
  "business_understanding": "",
  "opportunity": "",
  "website_direction": "",
  "google_presence_insight": "",
  "recommended_focus": [],
  "next_step": ""
}
`.trim();
    const aiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.OPENAI_API_KEY}`,
        "content-type": "application/json"
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0.35,
        messages: [
          {
            role: "system",
            content: "You return only valid JSON. No markdown. No commentary. You are a sharp local-business strategist: differentiation and buyer tradeoffs, not agency boilerplate."
          },
          { role: "user", content: prompt }
        ]
      })
    });
    const aiJson = await aiRes.json();
    if (!aiRes.ok) {
      return json7(
        {
          ok: false,
          error: aiJson?.error?.message || "OpenAI request failed",
          slug
        },
        502
      );
    }
    const content = aiJson?.choices?.[0]?.message?.content || "";
    let out;
    try {
      out = extractJsonObject2(content);
    } catch (e) {
      return json7(
        {
          ok: false,
          error: "Preview model did not return valid JSON",
          detail: String(e?.message || e),
          slug
        },
        502
      );
    }
    const body = {
      ok: true,
      slug,
      business_understanding: String(out.business_understanding || "").trim(),
      opportunity: String(out.opportunity || "").trim(),
      website_direction: String(out.website_direction || "").trim(),
      google_presence_insight: postProcessGoogleInsight(
        out.google_presence_insight,
        f.website,
        f.gbp_audit
      ),
      recommended_focus: Array.isArray(out.recommended_focus) ? out.recommended_focus.map((x) => String(x).trim()).filter(Boolean) : [],
      next_step: String(out.next_step || "").trim(),
      code: 200
    };
    return json7(body, 200);
  } catch (err) {
    return json7({ ok: false, error: String(err?.message || err) }, 500);
  }
}
__name(onRequest2, "onRequest2");
__name2(onRequest2, "onRequest");
function json8(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store"
    }
  });
}
__name(json8, "json8");
__name2(json8, "json");
function extractJsonObject3(text) {
  const raw = String(text || "").trim();
  if (!raw) {
    throw new Error("AI returned empty content");
  }
  try {
    return JSON.parse(raw);
  } catch {
  }
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    throw new Error("AI did not return valid JSON");
  }
  const sliced = raw.slice(start, end + 1);
  return JSON.parse(sliced);
}
__name(extractJsonObject3, "extractJsonObject3");
__name2(extractJsonObject3, "extractJsonObject");
async function onRequest3(context) {
  const { request, env } = context;
  if (request.method !== "POST") {
    return json8({ ok: false, error: "Use POST /api/preflight-recon" }, 405);
  }
  try {
    const body = await request.json();
    const slug = String(body.slug || "").trim();
    if (!slug) {
      return json8({ ok: false, error: "Missing slug" }, 400);
    }
    if (!env.APPS_SCRIPT_WEBAPP_URL) {
      throw new Error("Missing APPS_SCRIPT_WEBAPP_URL env var");
    }
    if (!env.FACTORY_KEY) {
      throw new Error("Missing FACTORY_KEY env var");
    }
    if (!env.OPENAI_API_KEY) {
      throw new Error("Missing OPENAI_API_KEY env var");
    }
    const statusRes = await fetch(new URL("/api/preflight-status", request.url), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ slug })
    });
    const status = await statusRes.json();
    if (!statusRes.ok || !status.ok) {
      return json8(
        {
          ok: false,
          error: status?.error || "Failed to load preflight status",
          slug
        },
        statusRes.status || 404
      );
    }
    const websiteHint = String(
      status.optional_website_or_social ?? status.client?.optional_website_or_social ?? status.website_or_social ?? ""
    ).trim();
    const prompt = `
      You are the SiteForge Factory Pre-Flight Recon Engine.
      
      Your job:
      Create a first-pass strategic assessment for a local business before the paid build intake begins.
      
      This output has TWO purposes:
      1. internal strategic intelligence for SiteForge
      2. a selective client-facing preview that inspires the client to move forward
      
      CRITICAL \u2014 DO NOT SUMMARIZE THE INPUT:
      - Your job is to ANALYZE and DIFFERENTIATE, not to paraphrase the description.
      - You must infer category dynamics, buyer psychology, and how this business wins vs typical local alternatives.
      - If the description is short, infer likely business reality from the name + location + category (clearly label inferences in internal_strategy.must_verify_now when needed).
      - Generic lines that could apply to any business in any city are a failure. Rewrite until every client_preview sentence could not apply verbatim to a random competitor.

      Important:
      - Do NOT give away the full strategy in the client-facing preview.
      - The client-facing preview should be persuasive, specific, and valuable, but incomplete.
      - Keep the strongest implementation details in internal_strategy and competitive_intelligence.
      - Use website/social hint below if present; it is not verified live\u2014treat as a signal only.
      - Do not mention Google Business Profile yet.
      - Focus on what makes this business a fit or non-fit for a high-performing single-page local business website.
      - Prefer practical local-business strategy over generic branding language.
      
      Business name:
      ${status.input_business_name}
      
      Location / service area:
      ${status.city_or_service_area_input}
      
      Business description:
      ${status.description_input}

      Website / social (optional, may be empty):
      ${websiteHint || "(none provided)"}
      
      Return ONLY valid JSON in this exact structure:
      
      {
        "entity_profile": {
          "primary_category": "",
          "secondary_categories": [],
          "business_model": "",
          "service_area": [],
          "strategic_archetype": "",
          "vertical_complexity": "",
          "one_page_fit": "",
          "confidence": 0
        },
        "competitive_intelligence": {
          "differentiation_hypothesis": "",
          "typical_local_alternatives": [],
          "what_buyers_compare": [],
          "likely_competitor_weaknesses": [],
          "winning_local_positioning_angle": ""
        },
        "buyer_intelligence": {
          "decision_factors": [],
          "common_objections": [],
          "trust_markers": [],
          "red_flags_customers_avoid": []
        },
        "internal_strategy": {
          "primary_conversion": "",
          "secondary_conversion": "",
          "recommended_sections": [],
          "faq_angles": [],
          "aeo_angles": [],
          "must_verify_now": [],
          "must_collect_paid_phase": [],
          "nice_to_have_assets": []
        },
        "client_preview": {
          "summary": "",
          "opportunity": "",
          "sales_preview": "",
          "recommended_focus": [],
          "next_step_teaser": ""
        },
        "experience_model": {
          "purchase_type": "",
          "decision_mode": "",
          "visual_importance": "",
          "trust_requirement": "",
          "pricing_behavior": "",
          "experience_rationale": ""
        },
        "component_importance": {
          "gallery": "",
          "process": "",
          "testimonials": "",
          "pricing_section": "",
          "comparison": "",
          "faqs": "",
          "service_area": "",
          "contact_conversion": "",
          "events_or_booking": "",
          "investment": ""
        },
        "visual_strategy": {
          "primary_visual_job": "",
          "gallery_story": "",
          "imagery_tone": "",
          "must_show": [],
          "avoid": []
        },
        "process_model": {
          "buyer_anxiety": [],
          "process_narrative": "",
          "steps_emphasis": "",
          "reassurance_devices": []
        },
        "pricing_model": {
          "site_treatment": "",
          "cta_alignment": "",
          "risk_language": "",
          "pricing_notes": ""
        }
      }
      
      Rules:
      
      ENTITY_PROFILE
      - "business_model" must be one of:
        "service_area", "storefront", "hybrid", "destination", "online"
      - "strategic_archetype" must be one of:
        "trust_safety_local_service",
        "experience_driven_local_business",
        "high_consideration_home_service",
        "visual_portfolio_service",
        "appointment_based_professional_service",
        "storefront_destination_business",
        "complex_multi_offer_business"
      - "vertical_complexity" must be one of:
        "low", "medium", "high"
      - "one_page_fit" must be one of:
        "excellent_fit", "conditional_fit", "complex_fit"
      - "confidence" must be a number from 0 to 1

      COMPETITIVE_INTELLIGENCE (required \u2014 this is not optional fluff)
      - "differentiation_hypothesis": one tight sentence: what is *different* about THIS business vs generic peers (e.g. artist-owned vs big-box framing, custom vs commodity).
      - "typical_local_alternatives": 2 to 5 realistic alternatives a buyer might choose instead (chains, online-only, big-box, mobile-only, etc.)\u2014specific to the category.
      - "what_buyers_compare": 3 to 7 concrete comparison points (price vs craft, turnaround, materials, trust, portfolio, convenience)\u2014not vague "quality".
      - "likely_competitor_weaknesses": where competitors in this category often underperform (specific, not "bad service").
      - "winning_local_positioning_angle": the single strongest angle to win locally for THIS business (specific nouns from the inputs when possible).

      PRIMARY_CATEGORY GUIDANCE
      - This must describe the industry category, not the business model.
      - Good examples:
        "Tour Operator"
        "Boat Tour Operator"
        "Sightseeing Tour Agency"
        "Electrician"
        "Roofing Contractor"
        "Wedding Photographer"
      - Do NOT use words like:
        "destination"
        "service_area"
        "hybrid"
        "online"
      - Those belong in business_model only.
      
      BUSINESS MODEL GUIDANCE
      - Use "service_area" when the business primarily travels to the customer
      - Use "storefront" when customers primarily come to a fixed public location
      - Use "hybrid" when both are meaningfully true
      - Use "destination" when the experience happens at a known launch point, venue, marina, studio, dock, or attraction area
      - For tours, charters, excursions, and destination-based activities, strongly prefer "destination" unless there is strong evidence otherwise
      
      BUYER_INTELLIGENCE
      - Keep lists practical and specific
      - Avoid generic filler like "quality service" unless clearly relevant
      - Think like a local buyer comparing options
      - Trust markers must be category-relevant, not generic digital-presence items
      - Avoid weak trust markers like "professional website" or "social media presence" unless truly central
      
      INTERNAL_STRATEGY
      - This is for SiteForge only
      - Be specific and useful
      - "primary_conversion" should be one of:
        "call_now", "request_quote", "book_now", "schedule_consultation", "submit_inquiry"
      - "secondary_conversion" should support the primary one
      - "recommended_sections" should be conversion-oriented website sections, not generic corporate page names
      - Prefer sections like:
        "Hero", "Trust Bar", "Service Area", "Packages", "Tour Options", "Gallery", "Testimonials", "FAQ", "Booking CTA", "Contact"
      - "aeo_angles" should be search-intent-oriented, not generic slogans
      - "must_verify_now" should contain critical facts the paid intake must confirm early
      - "must_collect_paid_phase" should contain category-relevant assets or info for the build
      - Do NOT include generic admin/platform items like hosting, domain registration, or broad market research unless absolutely necessary
      - Do NOT include internal-agency tasks like competition analysis in "must_verify_now"
      
      PAID INTAKE GUIDANCE
      - "must_verify_now" should usually include things like:
        offer structure, pricing approach, service area, booking flow, location details, phone, CTA preference, audience focus
      - "must_collect_paid_phase" should usually include real build assets like:
        photos, testimonials, package details, service descriptions, founder/captain bio, FAQs, proof items
      
      CLIENT_PREVIEW
      - This is what the buyer may see before paying
      - It should inspire confidence but NOT reveal the full implementation plan
      - Write like a premium strategist, not a generic agency salesperson
      - Avoid cheesy or overblown marketing language like:
        "Imagine a sleek website" or "unforgettable experience"
      - Avoid vague claims like:
        "enhance your online presence" unless made specific
      - Be concrete, specific, and restrained
      - "recommended_focus" should contain only 3 to 5 high-level focus areas
      - The preview should feel like:
        "we understand your business and see the opportunity"
        not:
        "here is the whole strategy"

      CLIENT_PREVIEW WRITING RULES
      - "summary" should be 1 to 2 sentences
      - "summary" should sound like a sharp positioning read on the business
      - FORBIDDEN in client_preview (any field): empty phrases like "uniquely positioned", "local art enthusiasts", "enhancing visibility", "drive foot traffic", "streamlined, visually engaging", "showcase offerings", "connect with you", "online presence" unless tied to a concrete mechanism.
      - "opportunity" must name a specific leverage point (e.g. trust gap, proof gap, category confusion, booking friction)\u2014not "grow your business".
      - "opportunity" should describe the business opportunity in practical terms
      - "sales_preview" should describe the kind of site outcome SiteForge could create, but without exposing the full blueprint
      - "recommended_focus" should be strategic themes, not implementation tasks
      - "next_step_teaser" should hint at what will be refined in the paid phase without listing everything

      CLIENT_PREVIEW TONE
      - premium
      - confident
      - observant
      - specific
      - restrained
      - no hype
      - no fluff
      - no generic agency clich\xE9s

      GOOD CLIENT PREVIEW EXAMPLE STYLE
      - "This business appears well positioned for a single-page site that makes the experience feel easy to trust and easy to book."
      - "The strongest opportunity is to turn interest from tourists and families into direct bookings with clearer tour positioning and stronger proof of the experience."
      - "The next phase would sharpen the offer, booking flow, and trust signals so the site feels more decision-ready."

      BAD CLIENT PREVIEW STYLE
      - "Imagine a sleek, user-friendly website..."
      - "We will enhance your online presence..."
      - "This unforgettable experience deserves..."

      AEO GUIDANCE
      - AEO angles should sound like likely search or answer-engine topics
      - Good example:
        "private boat tours in Marco Island"
      - Good example:
        "dolphin watching tours near Marco Island"
      - Bad example:
        "create unforgettable memories"
      
      CATEGORY CALIBRATION
      - For experience businesses, prioritize trust, safety, ease of booking, uniqueness, and proof of the experience
      - For home services, prioritize trust, professionalism, response speed, and service-area clarity
      - For visual services, prioritize portfolio proof and style differentiation
      - For appointment-based services, prioritize credentials, clarity, and ease of scheduling
      - For client_preview, reflect the buyer psychology of the category without revealing the full internal strategy

      EXPERIENCE STRATEGY LAYER (required \u2014 prescribes HOW the site should work, not just WHAT the business is)
      - Infer from category dynamics, risk, purchase complexity, and proof needs. Do NOT name a canned industry template (no "because framing shop" boilerplate).
      - Do NOT hardcode verticals: every enum choice must be justified by signals in the inputs (description, name, location, optional URL hint).

      experience_model ENUMS (use exactly one string per field from these lists):
      - purchase_type:
        "impulse_or_quick" | "transactional_standard" | "consultative_service" | "scheduled_experience" | "high_stakes_project" | "emergency_or_urgent" | "relationship_ongoing"
      - decision_mode:
        "self_serve_compare" | "guided_education" | "appointment_required" | "multi_visit_decision" | "committee_or_family"
      - visual_importance:
        "low" | "medium" | "high" | "critical"
      - trust_requirement:
        "light_social_proof" | "moderate_credibility" | "high_personal_risk" | "high_technical_proof" | "safety_or_compliance"
      - pricing_behavior:
        "transparent_list" | "starting_at_or_ranges" | "quote_after_scope" | "consultation_first_no_public_numbers" | "variable_donation_or_custom" | "not_applicable"
      - experience_rationale: 1\u20132 sentences tying the enums to buyer reality (specific, non-generic).

      component_importance ENUMS (each key: "none" | "low" | "medium" | "high" | "critical"):
      - Score gallery, process, testimonials, pricing_section, comparison, faqs, service_area, contact_conversion, events_or_booking, investment.
      - Priorities MUST follow experience_model (e.g. critical visual_importance \u2192 gallery high/critical; high_technical trust \u2192 testimonials+process often high; consultation_first pricing \u2192 pricing_section explains value, avoids naked price lists).
      - Do not set everything to "high". Differentiate: at least three keys must be below "high" unless the description demands otherwise.

      visual_strategy ENUMS:
      - primary_visual_job:
        "establish_trust" | "show_transformation" | "show_craft_detail" | "show_environment_context" | "show_people_and_relationships" | "show_variety_and_range"
      - imagery_tone:
        "minimal_clean" | "editorial" | "warm_personal" | "technical_precise" | "luxury_restrained" | "bold_expressive"
      - gallery_story: one sentence \u2014 what the gallery must prove to win the buyer (not "show photos").
      - must_show: 2\u20135 concrete visual proof concepts (objects/behaviors/materials/outcomes), not generic "quality photos".
      - avoid: 1\u20134 visual clich\xE9s that would undermine trust for THIS category.

      process_model ENUMS:
      - steps_emphasis:
        "walk_in_simple" | "call_first" | "schedule_consult" | "quote_then_schedule" | "deposit_milestone" | "remote_then_in_person"
      - buyer_anxiety: 3\u20137 specific worries (not "bad service").
      - process_narrative: 2\u20134 sentences \u2014 how the journey should feel on the site to reduce anxiety (consultative, guided, transparent).
      - reassurance_devices: 3\u20137 concrete credibility mechanisms (e.g. archival materials, warranties, measurement process) \u2014 category-appropriate, not filler.

      pricing_model ENUMS:
      - cta_alignment: "call" | "request_quote" | "book_consultation" | "schedule_visit" | "transparent_buy" | "donate_or_custom"
      - risk_language: "prefer_no_public_numbers" | "ranges_ok" | "starting_at_ok" | "full_transparency_ok"
      - site_treatment: 2\u20133 sentences \u2014 how pricing should behave on the site (consultation CTA vs list vs ranges), tied to pricing_behavior.
      - pricing_notes: optional short caveats (scope drivers, custom work, rush fees) \u2014 only if inferable.

      ALIGN internal_strategy WITH EXPERIENCE LAYER
      - recommended_sections and faq_angles should reflect component_importance and process_model (e.g. if process/testimonials are high, sections should include concrete proof paths, not generic labels).
      - Do NOT contradict experience_model.pricing_behavior in pricing_model.site_treatment.

      Return JSON only. No markdown. No commentary.
      `;
    const aiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.OPENAI_API_KEY}`,
        "content-type": "application/json"
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0.3,
        messages: [
          {
            role: "system",
            content: "You return only valid JSON. No markdown. No commentary."
          },
          {
            role: "user",
            content: prompt
          }
        ]
      })
    });
    const aiJson = await aiRes.json();
    if (!aiRes.ok) {
      return json8(
        {
          ok: false,
          error: aiJson?.error?.message || "OpenAI request failed"
        },
        502
      );
    }
    const content = aiJson?.choices?.[0]?.message?.content || "";
    const parsed = extractJsonObject3(content);
    const appsScriptPayload = {
      route: "preflight_recon",
      factory_key: env.FACTORY_KEY,
      slug,
      entity_profile: parsed.entity_profile || {},
      competitive_intelligence: parsed.competitive_intelligence || {},
      buyer_intelligence: parsed.buyer_intelligence || {},
      internal_strategy: parsed.internal_strategy || {},
      client_preview: parsed.client_preview || {},
      experience_model: parsed.experience_model || {},
      component_importance: parsed.component_importance || {},
      visual_strategy: parsed.visual_strategy || {},
      process_model: parsed.process_model || {},
      pricing_model: parsed.pricing_model || {}
    };
    const persistRes = await fetch(env.APPS_SCRIPT_WEBAPP_URL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(appsScriptPayload)
    });
    const persistText = await persistRes.text();
    return new Response(persistText, {
      status: persistRes.status,
      headers: { "content-type": "application/json; charset=utf-8" }
    });
  } catch (err) {
    return json8(
      {
        ok: false,
        error: String(err?.message || err)
      },
      500
    );
  }
}
__name(onRequest3, "onRequest3");
__name2(onRequest3, "onRequest");
async function onRequest4(context) {
  const { request, env } = context;
  if (request.method !== "POST") {
    return new Response(JSON.stringify({ ok: false, error: "Use POST /api/preflight-start" }), {
      status: 405,
      headers: { "content-type": "application/json" }
    });
  }
  try {
    const body = await request.json();
    const business_name = String(body.business_name || "").trim();
    const city_or_service_area = String(body.city_or_service_area || "").trim();
    const description = String(body.description || "").trim();
    const website_or_social = String(body.website_or_social || "").trim();
    const client_email = String(body.client_email || "").trim();
    if (!business_name) {
      return new Response(JSON.stringify({ ok: false, error: "Missing business_name" }), {
        status: 400,
        headers: { "content-type": "application/json" }
      });
    }
    if (!city_or_service_area) {
      return new Response(JSON.stringify({ ok: false, error: "Missing city_or_service_area" }), {
        status: 400,
        headers: { "content-type": "application/json" }
      });
    }
    if (!description) {
      return new Response(JSON.stringify({ ok: false, error: "Missing description" }), {
        status: 400,
        headers: { "content-type": "application/json" }
      });
    }
    const url = env.APPS_SCRIPT_WEBAPP_URL;
    const factoryKey = env.FACTORY_KEY;
    if (!url) throw new Error("Missing APPS_SCRIPT_WEBAPP_URL env var");
    if (!factoryKey) throw new Error("Missing FACTORY_KEY env var");
    const payload = {
      route: "preflight_start",
      factory_key: factoryKey,
      business_name,
      city_or_service_area,
      description,
      website_or_social,
      client_email
    };
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload)
    });
    const text = await res.text();
    return new Response(text, {
      status: res.status,
      headers: { "content-type": "application/json" }
    });
  } catch (err) {
    return new Response(JSON.stringify({ ok: false, error: String(err?.message || err) }), {
      status: 500,
      headers: { "content-type": "application/json" }
    });
  }
}
__name(onRequest4, "onRequest4");
__name2(onRequest4, "onRequest");
async function onRequest5(context) {
  const { request, env } = context;
  if (request.method !== "POST") {
    return new Response(JSON.stringify({ ok: false, error: "Use POST /api/preflight-status" }), {
      status: 405,
      headers: { "content-type": "application/json" }
    });
  }
  try {
    const body = await request.json();
    const slug = String(body.slug || "").trim();
    if (!slug) {
      return new Response(JSON.stringify({ ok: false, error: "Missing slug" }), {
        status: 400,
        headers: { "content-type": "application/json" }
      });
    }
    const url = env.APPS_SCRIPT_WEBAPP_URL;
    const factoryKey = env.FACTORY_KEY;
    if (!url) throw new Error("Missing APPS_SCRIPT_WEBAPP_URL env var");
    if (!factoryKey) throw new Error("Missing FACTORY_KEY env var");
    const payload = {
      route: "preflight_status",
      factory_key: factoryKey,
      slug
    };
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload)
    });
    const text = await res.text();
    return new Response(text, {
      status: res.status,
      headers: { "content-type": "application/json" }
    });
  } catch (err) {
    return new Response(JSON.stringify({ ok: false, error: String(err?.message || err) }), {
      status: 500,
      headers: { "content-type": "application/json" }
    });
  }
}
__name(onRequest5, "onRequest5");
__name2(onRequest5, "onRequest");
async function onRequest6(context) {
  const { request, env } = context;
  if (request.method !== "POST") {
    return new Response(JSON.stringify({ ok: false, error: "Use POST /api/submit" }), {
      status: 405,
      headers: { "content-type": "application/json" }
    });
  }
  try {
    const body = await request.json();
    const url = env.APPS_SCRIPT_WEBAPP_URL;
    const factoryKey = env.FACTORY_KEY;
    if (!url) throw new Error("Missing APPS_SCRIPT_WEBAPP_URL env var");
    if (!factoryKey) throw new Error("Missing FACTORY_KEY env var");
    const payload = {
      factory_key: factoryKey,
      business_json: body.business_json,
      client_email: body.client_email || body.business_json?.brand?.email || ""
    };
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload)
    });
    const text = await res.text();
    if (!res.ok) throw new Error(`Apps Script error ${res.status}: ${text}`);
    return new Response(text, { headers: { "content-type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ ok: false, error: String(err?.message || err) }), {
      status: 500,
      headers: { "content-type": "application/json" }
    });
  }
}
__name(onRequest6, "onRequest6");
__name2(onRequest6, "onRequest");
var routes = [
  {
    routePath: "/api/generate",
    mountPath: "/api",
    method: "POST",
    middlewares: [],
    modules: [onRequestPost]
  },
  {
    routePath: "/api/health",
    mountPath: "/api",
    method: "GET",
    middlewares: [],
    modules: [onRequestGet]
  },
  {
    routePath: "/api/intake-complete",
    mountPath: "/api",
    method: "GET",
    middlewares: [],
    modules: [onRequestGet2]
  },
  {
    routePath: "/api/intake-complete",
    mountPath: "/api",
    method: "POST",
    middlewares: [],
    modules: [onRequestPost2]
  },
  {
    routePath: "/api/intake-next-v2",
    mountPath: "/api",
    method: "GET",
    middlewares: [],
    modules: [onRequestGet3]
  },
  {
    routePath: "/api/intake-next-v2",
    mountPath: "/api",
    method: "POST",
    middlewares: [],
    modules: [onRequestPost3]
  },
  {
    routePath: "/api/intake-start-v2",
    mountPath: "/api",
    method: "POST",
    middlewares: [],
    modules: [onRequestPost4]
  },
  {
    routePath: "/api/status",
    mountPath: "/api",
    method: "GET",
    middlewares: [],
    modules: [onRequestGet4]
  },
  {
    routePath: "/api/preflight-gbp",
    mountPath: "/api",
    method: "",
    middlewares: [],
    modules: [onRequest]
  },
  {
    routePath: "/api/preflight-preview",
    mountPath: "/api",
    method: "",
    middlewares: [],
    modules: [onRequest2]
  },
  {
    routePath: "/api/preflight-recon",
    mountPath: "/api",
    method: "",
    middlewares: [],
    modules: [onRequest3]
  },
  {
    routePath: "/api/preflight-start",
    mountPath: "/api",
    method: "",
    middlewares: [],
    modules: [onRequest4]
  },
  {
    routePath: "/api/preflight-status",
    mountPath: "/api",
    method: "",
    middlewares: [],
    modules: [onRequest5]
  },
  {
    routePath: "/api/submit",
    mountPath: "/api",
    method: "",
    middlewares: [],
    modules: [onRequest6]
  }
];
function lexer(str) {
  var tokens = [];
  var i = 0;
  while (i < str.length) {
    var char = str[i];
    if (char === "*" || char === "+" || char === "?") {
      tokens.push({ type: "MODIFIER", index: i, value: str[i++] });
      continue;
    }
    if (char === "\\") {
      tokens.push({ type: "ESCAPED_CHAR", index: i++, value: str[i++] });
      continue;
    }
    if (char === "{") {
      tokens.push({ type: "OPEN", index: i, value: str[i++] });
      continue;
    }
    if (char === "}") {
      tokens.push({ type: "CLOSE", index: i, value: str[i++] });
      continue;
    }
    if (char === ":") {
      var name = "";
      var j = i + 1;
      while (j < str.length) {
        var code = str.charCodeAt(j);
        if (
          // `0-9`
          code >= 48 && code <= 57 || // `A-Z`
          code >= 65 && code <= 90 || // `a-z`
          code >= 97 && code <= 122 || // `_`
          code === 95
        ) {
          name += str[j++];
          continue;
        }
        break;
      }
      if (!name)
        throw new TypeError("Missing parameter name at ".concat(i));
      tokens.push({ type: "NAME", index: i, value: name });
      i = j;
      continue;
    }
    if (char === "(") {
      var count = 1;
      var pattern = "";
      var j = i + 1;
      if (str[j] === "?") {
        throw new TypeError('Pattern cannot start with "?" at '.concat(j));
      }
      while (j < str.length) {
        if (str[j] === "\\") {
          pattern += str[j++] + str[j++];
          continue;
        }
        if (str[j] === ")") {
          count--;
          if (count === 0) {
            j++;
            break;
          }
        } else if (str[j] === "(") {
          count++;
          if (str[j + 1] !== "?") {
            throw new TypeError("Capturing groups are not allowed at ".concat(j));
          }
        }
        pattern += str[j++];
      }
      if (count)
        throw new TypeError("Unbalanced pattern at ".concat(i));
      if (!pattern)
        throw new TypeError("Missing pattern at ".concat(i));
      tokens.push({ type: "PATTERN", index: i, value: pattern });
      i = j;
      continue;
    }
    tokens.push({ type: "CHAR", index: i, value: str[i++] });
  }
  tokens.push({ type: "END", index: i, value: "" });
  return tokens;
}
__name(lexer, "lexer");
__name2(lexer, "lexer");
function parse(str, options) {
  if (options === void 0) {
    options = {};
  }
  var tokens = lexer(str);
  var _a = options.prefixes, prefixes = _a === void 0 ? "./" : _a, _b = options.delimiter, delimiter = _b === void 0 ? "/#?" : _b;
  var result = [];
  var key = 0;
  var i = 0;
  var path = "";
  var tryConsume = /* @__PURE__ */ __name2(function(type) {
    if (i < tokens.length && tokens[i].type === type)
      return tokens[i++].value;
  }, "tryConsume");
  var mustConsume = /* @__PURE__ */ __name2(function(type) {
    var value2 = tryConsume(type);
    if (value2 !== void 0)
      return value2;
    var _a2 = tokens[i], nextType = _a2.type, index = _a2.index;
    throw new TypeError("Unexpected ".concat(nextType, " at ").concat(index, ", expected ").concat(type));
  }, "mustConsume");
  var consumeText = /* @__PURE__ */ __name2(function() {
    var result2 = "";
    var value2;
    while (value2 = tryConsume("CHAR") || tryConsume("ESCAPED_CHAR")) {
      result2 += value2;
    }
    return result2;
  }, "consumeText");
  var isSafe = /* @__PURE__ */ __name2(function(value2) {
    for (var _i = 0, delimiter_1 = delimiter; _i < delimiter_1.length; _i++) {
      var char2 = delimiter_1[_i];
      if (value2.indexOf(char2) > -1)
        return true;
    }
    return false;
  }, "isSafe");
  var safePattern = /* @__PURE__ */ __name2(function(prefix2) {
    var prev = result[result.length - 1];
    var prevText = prefix2 || (prev && typeof prev === "string" ? prev : "");
    if (prev && !prevText) {
      throw new TypeError('Must have text between two parameters, missing text after "'.concat(prev.name, '"'));
    }
    if (!prevText || isSafe(prevText))
      return "[^".concat(escapeString(delimiter), "]+?");
    return "(?:(?!".concat(escapeString(prevText), ")[^").concat(escapeString(delimiter), "])+?");
  }, "safePattern");
  while (i < tokens.length) {
    var char = tryConsume("CHAR");
    var name = tryConsume("NAME");
    var pattern = tryConsume("PATTERN");
    if (name || pattern) {
      var prefix = char || "";
      if (prefixes.indexOf(prefix) === -1) {
        path += prefix;
        prefix = "";
      }
      if (path) {
        result.push(path);
        path = "";
      }
      result.push({
        name: name || key++,
        prefix,
        suffix: "",
        pattern: pattern || safePattern(prefix),
        modifier: tryConsume("MODIFIER") || ""
      });
      continue;
    }
    var value = char || tryConsume("ESCAPED_CHAR");
    if (value) {
      path += value;
      continue;
    }
    if (path) {
      result.push(path);
      path = "";
    }
    var open = tryConsume("OPEN");
    if (open) {
      var prefix = consumeText();
      var name_1 = tryConsume("NAME") || "";
      var pattern_1 = tryConsume("PATTERN") || "";
      var suffix = consumeText();
      mustConsume("CLOSE");
      result.push({
        name: name_1 || (pattern_1 ? key++ : ""),
        pattern: name_1 && !pattern_1 ? safePattern(prefix) : pattern_1,
        prefix,
        suffix,
        modifier: tryConsume("MODIFIER") || ""
      });
      continue;
    }
    mustConsume("END");
  }
  return result;
}
__name(parse, "parse");
__name2(parse, "parse");
function match(str, options) {
  var keys = [];
  var re = pathToRegexp(str, keys, options);
  return regexpToFunction(re, keys, options);
}
__name(match, "match");
__name2(match, "match");
function regexpToFunction(re, keys, options) {
  if (options === void 0) {
    options = {};
  }
  var _a = options.decode, decode = _a === void 0 ? function(x) {
    return x;
  } : _a;
  return function(pathname) {
    var m = re.exec(pathname);
    if (!m)
      return false;
    var path = m[0], index = m.index;
    var params = /* @__PURE__ */ Object.create(null);
    var _loop_1 = /* @__PURE__ */ __name2(function(i2) {
      if (m[i2] === void 0)
        return "continue";
      var key = keys[i2 - 1];
      if (key.modifier === "*" || key.modifier === "+") {
        params[key.name] = m[i2].split(key.prefix + key.suffix).map(function(value) {
          return decode(value, key);
        });
      } else {
        params[key.name] = decode(m[i2], key);
      }
    }, "_loop_1");
    for (var i = 1; i < m.length; i++) {
      _loop_1(i);
    }
    return { path, index, params };
  };
}
__name(regexpToFunction, "regexpToFunction");
__name2(regexpToFunction, "regexpToFunction");
function escapeString(str) {
  return str.replace(/([.+*?=^!:${}()[\]|/\\])/g, "\\$1");
}
__name(escapeString, "escapeString");
__name2(escapeString, "escapeString");
function flags(options) {
  return options && options.sensitive ? "" : "i";
}
__name(flags, "flags");
__name2(flags, "flags");
function regexpToRegexp(path, keys) {
  if (!keys)
    return path;
  var groupsRegex = /\((?:\?<(.*?)>)?(?!\?)/g;
  var index = 0;
  var execResult = groupsRegex.exec(path.source);
  while (execResult) {
    keys.push({
      // Use parenthesized substring match if available, index otherwise
      name: execResult[1] || index++,
      prefix: "",
      suffix: "",
      modifier: "",
      pattern: ""
    });
    execResult = groupsRegex.exec(path.source);
  }
  return path;
}
__name(regexpToRegexp, "regexpToRegexp");
__name2(regexpToRegexp, "regexpToRegexp");
function arrayToRegexp(paths, keys, options) {
  var parts = paths.map(function(path) {
    return pathToRegexp(path, keys, options).source;
  });
  return new RegExp("(?:".concat(parts.join("|"), ")"), flags(options));
}
__name(arrayToRegexp, "arrayToRegexp");
__name2(arrayToRegexp, "arrayToRegexp");
function stringToRegexp(path, keys, options) {
  return tokensToRegexp(parse(path, options), keys, options);
}
__name(stringToRegexp, "stringToRegexp");
__name2(stringToRegexp, "stringToRegexp");
function tokensToRegexp(tokens, keys, options) {
  if (options === void 0) {
    options = {};
  }
  var _a = options.strict, strict = _a === void 0 ? false : _a, _b = options.start, start = _b === void 0 ? true : _b, _c = options.end, end = _c === void 0 ? true : _c, _d = options.encode, encode = _d === void 0 ? function(x) {
    return x;
  } : _d, _e = options.delimiter, delimiter = _e === void 0 ? "/#?" : _e, _f = options.endsWith, endsWith = _f === void 0 ? "" : _f;
  var endsWithRe = "[".concat(escapeString(endsWith), "]|$");
  var delimiterRe = "[".concat(escapeString(delimiter), "]");
  var route = start ? "^" : "";
  for (var _i = 0, tokens_1 = tokens; _i < tokens_1.length; _i++) {
    var token = tokens_1[_i];
    if (typeof token === "string") {
      route += escapeString(encode(token));
    } else {
      var prefix = escapeString(encode(token.prefix));
      var suffix = escapeString(encode(token.suffix));
      if (token.pattern) {
        if (keys)
          keys.push(token);
        if (prefix || suffix) {
          if (token.modifier === "+" || token.modifier === "*") {
            var mod = token.modifier === "*" ? "?" : "";
            route += "(?:".concat(prefix, "((?:").concat(token.pattern, ")(?:").concat(suffix).concat(prefix, "(?:").concat(token.pattern, "))*)").concat(suffix, ")").concat(mod);
          } else {
            route += "(?:".concat(prefix, "(").concat(token.pattern, ")").concat(suffix, ")").concat(token.modifier);
          }
        } else {
          if (token.modifier === "+" || token.modifier === "*") {
            throw new TypeError('Can not repeat "'.concat(token.name, '" without a prefix and suffix'));
          }
          route += "(".concat(token.pattern, ")").concat(token.modifier);
        }
      } else {
        route += "(?:".concat(prefix).concat(suffix, ")").concat(token.modifier);
      }
    }
  }
  if (end) {
    if (!strict)
      route += "".concat(delimiterRe, "?");
    route += !options.endsWith ? "$" : "(?=".concat(endsWithRe, ")");
  } else {
    var endToken = tokens[tokens.length - 1];
    var isEndDelimited = typeof endToken === "string" ? delimiterRe.indexOf(endToken[endToken.length - 1]) > -1 : endToken === void 0;
    if (!strict) {
      route += "(?:".concat(delimiterRe, "(?=").concat(endsWithRe, "))?");
    }
    if (!isEndDelimited) {
      route += "(?=".concat(delimiterRe, "|").concat(endsWithRe, ")");
    }
  }
  return new RegExp(route, flags(options));
}
__name(tokensToRegexp, "tokensToRegexp");
__name2(tokensToRegexp, "tokensToRegexp");
function pathToRegexp(path, keys, options) {
  if (path instanceof RegExp)
    return regexpToRegexp(path, keys);
  if (Array.isArray(path))
    return arrayToRegexp(path, keys, options);
  return stringToRegexp(path, keys, options);
}
__name(pathToRegexp, "pathToRegexp");
__name2(pathToRegexp, "pathToRegexp");
var escapeRegex = /[.+?^${}()|[\]\\]/g;
function* executeRequest(request) {
  const requestPath = new URL(request.url).pathname;
  for (const route of [...routes].reverse()) {
    if (route.method && route.method !== request.method) {
      continue;
    }
    const routeMatcher = match(route.routePath.replace(escapeRegex, "\\$&"), {
      end: false
    });
    const mountMatcher = match(route.mountPath.replace(escapeRegex, "\\$&"), {
      end: false
    });
    const matchResult = routeMatcher(requestPath);
    const mountMatchResult = mountMatcher(requestPath);
    if (matchResult && mountMatchResult) {
      for (const handler of route.middlewares.flat()) {
        yield {
          handler,
          params: matchResult.params,
          path: mountMatchResult.path
        };
      }
    }
  }
  for (const route of routes) {
    if (route.method && route.method !== request.method) {
      continue;
    }
    const routeMatcher = match(route.routePath.replace(escapeRegex, "\\$&"), {
      end: true
    });
    const mountMatcher = match(route.mountPath.replace(escapeRegex, "\\$&"), {
      end: false
    });
    const matchResult = routeMatcher(requestPath);
    const mountMatchResult = mountMatcher(requestPath);
    if (matchResult && mountMatchResult && route.modules.length) {
      for (const handler of route.modules.flat()) {
        yield {
          handler,
          params: matchResult.params,
          path: matchResult.path
        };
      }
      break;
    }
  }
}
__name(executeRequest, "executeRequest");
__name2(executeRequest, "executeRequest");
var pages_template_worker_default = {
  async fetch(originalRequest, env, workerContext) {
    let request = originalRequest;
    const handlerIterator = executeRequest(request);
    let data = {};
    let isFailOpen = false;
    const next = /* @__PURE__ */ __name2(async (input, init) => {
      if (input !== void 0) {
        let url = input;
        if (typeof input === "string") {
          url = new URL(input, request.url).toString();
        }
        request = new Request(url, init);
      }
      const result = handlerIterator.next();
      if (result.done === false) {
        const { handler, params, path } = result.value;
        const context = {
          request: new Request(request.clone()),
          functionPath: path,
          next,
          params,
          get data() {
            return data;
          },
          set data(value) {
            if (typeof value !== "object" || value === null) {
              throw new Error("context.data must be an object");
            }
            data = value;
          },
          env,
          waitUntil: workerContext.waitUntil.bind(workerContext),
          passThroughOnException: /* @__PURE__ */ __name2(() => {
            isFailOpen = true;
          }, "passThroughOnException")
        };
        const response = await handler(context);
        if (!(response instanceof Response)) {
          throw new Error("Your Pages function should return a Response");
        }
        return cloneResponse(response);
      } else if ("ASSETS") {
        const response = await env["ASSETS"].fetch(request);
        return cloneResponse(response);
      } else {
        const response = await fetch(request);
        return cloneResponse(response);
      }
    }, "next");
    try {
      return await next();
    } catch (error) {
      if (isFailOpen) {
        const response = await env["ASSETS"].fetch(request);
        return cloneResponse(response);
      }
      throw error;
    }
  }
};
var cloneResponse = /* @__PURE__ */ __name2((response) => (
  // https://fetch.spec.whatwg.org/#null-body-status
  new Response(
    [101, 204, 205, 304].includes(response.status) ? null : response.body,
    response
  )
), "cloneResponse");
var drainBody = /* @__PURE__ */ __name2(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } finally {
    try {
      if (request.body !== null && !request.bodyUsed) {
        const reader = request.body.getReader();
        while (!(await reader.read()).done) {
        }
      }
    } catch (e) {
      console.error("Failed to drain the unused request body.", e);
    }
  }
}, "drainBody");
var middleware_ensure_req_body_drained_default = drainBody;
function reduceError(e) {
  return {
    name: e?.name,
    message: e?.message ?? String(e),
    stack: e?.stack,
    cause: e?.cause === void 0 ? void 0 : reduceError(e.cause)
  };
}
__name(reduceError, "reduceError");
__name2(reduceError, "reduceError");
var jsonError = /* @__PURE__ */ __name2(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } catch (e) {
    const error = reduceError(e);
    return Response.json(error, {
      status: 500,
      headers: { "MF-Experimental-Error-Stack": "true" }
    });
  }
}, "jsonError");
var middleware_miniflare3_json_error_default = jsonError;
var __INTERNAL_WRANGLER_MIDDLEWARE__ = [
  middleware_ensure_req_body_drained_default,
  middleware_miniflare3_json_error_default
];
var middleware_insertion_facade_default = pages_template_worker_default;
var __facade_middleware__ = [];
function __facade_register__(...args) {
  __facade_middleware__.push(...args.flat());
}
__name(__facade_register__, "__facade_register__");
__name2(__facade_register__, "__facade_register__");
function __facade_invokeChain__(request, env, ctx, dispatch, middlewareChain) {
  const [head, ...tail] = middlewareChain;
  const middlewareCtx = {
    dispatch,
    next(newRequest, newEnv) {
      return __facade_invokeChain__(newRequest, newEnv, ctx, dispatch, tail);
    }
  };
  return head(request, env, ctx, middlewareCtx);
}
__name(__facade_invokeChain__, "__facade_invokeChain__");
__name2(__facade_invokeChain__, "__facade_invokeChain__");
function __facade_invoke__(request, env, ctx, dispatch, finalMiddleware) {
  return __facade_invokeChain__(request, env, ctx, dispatch, [
    ...__facade_middleware__,
    finalMiddleware
  ]);
}
__name(__facade_invoke__, "__facade_invoke__");
__name2(__facade_invoke__, "__facade_invoke__");
var __Facade_ScheduledController__ = class ___Facade_ScheduledController__ {
  static {
    __name(this, "___Facade_ScheduledController__");
  }
  constructor(scheduledTime, cron, noRetry) {
    this.scheduledTime = scheduledTime;
    this.cron = cron;
    this.#noRetry = noRetry;
  }
  static {
    __name2(this, "__Facade_ScheduledController__");
  }
  #noRetry;
  noRetry() {
    if (!(this instanceof ___Facade_ScheduledController__)) {
      throw new TypeError("Illegal invocation");
    }
    this.#noRetry();
  }
};
function wrapExportedHandler(worker) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return worker;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  const fetchDispatcher = /* @__PURE__ */ __name2(function(request, env, ctx) {
    if (worker.fetch === void 0) {
      throw new Error("Handler does not export a fetch() function.");
    }
    return worker.fetch(request, env, ctx);
  }, "fetchDispatcher");
  return {
    ...worker,
    fetch(request, env, ctx) {
      const dispatcher = /* @__PURE__ */ __name2(function(type, init) {
        if (type === "scheduled" && worker.scheduled !== void 0) {
          const controller = new __Facade_ScheduledController__(
            Date.now(),
            init.cron ?? "",
            () => {
            }
          );
          return worker.scheduled(controller, env, ctx);
        }
      }, "dispatcher");
      return __facade_invoke__(request, env, ctx, dispatcher, fetchDispatcher);
    }
  };
}
__name(wrapExportedHandler, "wrapExportedHandler");
__name2(wrapExportedHandler, "wrapExportedHandler");
function wrapWorkerEntrypoint(klass) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return klass;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  return class extends klass {
    #fetchDispatcher = /* @__PURE__ */ __name2((request, env, ctx) => {
      this.env = env;
      this.ctx = ctx;
      if (super.fetch === void 0) {
        throw new Error("Entrypoint class does not define a fetch() function.");
      }
      return super.fetch(request);
    }, "#fetchDispatcher");
    #dispatcher = /* @__PURE__ */ __name2((type, init) => {
      if (type === "scheduled" && super.scheduled !== void 0) {
        const controller = new __Facade_ScheduledController__(
          Date.now(),
          init.cron ?? "",
          () => {
          }
        );
        return super.scheduled(controller);
      }
    }, "#dispatcher");
    fetch(request) {
      return __facade_invoke__(
        request,
        this.env,
        this.ctx,
        this.#dispatcher,
        this.#fetchDispatcher
      );
    }
  };
}
__name(wrapWorkerEntrypoint, "wrapWorkerEntrypoint");
__name2(wrapWorkerEntrypoint, "wrapWorkerEntrypoint");
var WRAPPED_ENTRY;
if (typeof middleware_insertion_facade_default === "object") {
  WRAPPED_ENTRY = wrapExportedHandler(middleware_insertion_facade_default);
} else if (typeof middleware_insertion_facade_default === "function") {
  WRAPPED_ENTRY = wrapWorkerEntrypoint(middleware_insertion_facade_default);
}
var middleware_loader_entry_default = WRAPPED_ENTRY;

// ../../../../.nvm/versions/node/v24.14.1/lib/node_modules/wrangler/templates/middleware/middleware-ensure-req-body-drained.ts
var drainBody2 = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } finally {
    try {
      if (request.body !== null && !request.bodyUsed) {
        const reader = request.body.getReader();
        while (!(await reader.read()).done) {
        }
      }
    } catch (e) {
      console.error("Failed to drain the unused request body.", e);
    }
  }
}, "drainBody");
var middleware_ensure_req_body_drained_default2 = drainBody2;

// ../../../../.nvm/versions/node/v24.14.1/lib/node_modules/wrangler/templates/middleware/middleware-miniflare3-json-error.ts
function reduceError2(e) {
  return {
    name: e?.name,
    message: e?.message ?? String(e),
    stack: e?.stack,
    cause: e?.cause === void 0 ? void 0 : reduceError2(e.cause)
  };
}
__name(reduceError2, "reduceError");
var jsonError2 = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } catch (e) {
    const error = reduceError2(e);
    return Response.json(error, {
      status: 500,
      headers: { "MF-Experimental-Error-Stack": "true" }
    });
  }
}, "jsonError");
var middleware_miniflare3_json_error_default2 = jsonError2;

// .wrangler/tmp/bundle-9oOjIr/middleware-insertion-facade.js
var __INTERNAL_WRANGLER_MIDDLEWARE__2 = [
  middleware_ensure_req_body_drained_default2,
  middleware_miniflare3_json_error_default2
];
var middleware_insertion_facade_default2 = middleware_loader_entry_default;

// ../../../../.nvm/versions/node/v24.14.1/lib/node_modules/wrangler/templates/middleware/common.ts
var __facade_middleware__2 = [];
function __facade_register__2(...args) {
  __facade_middleware__2.push(...args.flat());
}
__name(__facade_register__2, "__facade_register__");
function __facade_invokeChain__2(request, env, ctx, dispatch, middlewareChain) {
  const [head, ...tail] = middlewareChain;
  const middlewareCtx = {
    dispatch,
    next(newRequest, newEnv) {
      return __facade_invokeChain__2(newRequest, newEnv, ctx, dispatch, tail);
    }
  };
  return head(request, env, ctx, middlewareCtx);
}
__name(__facade_invokeChain__2, "__facade_invokeChain__");
function __facade_invoke__2(request, env, ctx, dispatch, finalMiddleware) {
  return __facade_invokeChain__2(request, env, ctx, dispatch, [
    ...__facade_middleware__2,
    finalMiddleware
  ]);
}
__name(__facade_invoke__2, "__facade_invoke__");

// .wrangler/tmp/bundle-9oOjIr/middleware-loader.entry.ts
var __Facade_ScheduledController__2 = class ___Facade_ScheduledController__2 {
  constructor(scheduledTime, cron, noRetry) {
    this.scheduledTime = scheduledTime;
    this.cron = cron;
    this.#noRetry = noRetry;
  }
  static {
    __name(this, "__Facade_ScheduledController__");
  }
  #noRetry;
  noRetry() {
    if (!(this instanceof ___Facade_ScheduledController__2)) {
      throw new TypeError("Illegal invocation");
    }
    this.#noRetry();
  }
};
function wrapExportedHandler2(worker) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__2 === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__2.length === 0) {
    return worker;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__2) {
    __facade_register__2(middleware);
  }
  const fetchDispatcher = /* @__PURE__ */ __name(function(request, env, ctx) {
    if (worker.fetch === void 0) {
      throw new Error("Handler does not export a fetch() function.");
    }
    return worker.fetch(request, env, ctx);
  }, "fetchDispatcher");
  return {
    ...worker,
    fetch(request, env, ctx) {
      const dispatcher = /* @__PURE__ */ __name(function(type, init) {
        if (type === "scheduled" && worker.scheduled !== void 0) {
          const controller = new __Facade_ScheduledController__2(
            Date.now(),
            init.cron ?? "",
            () => {
            }
          );
          return worker.scheduled(controller, env, ctx);
        }
      }, "dispatcher");
      return __facade_invoke__2(request, env, ctx, dispatcher, fetchDispatcher);
    }
  };
}
__name(wrapExportedHandler2, "wrapExportedHandler");
function wrapWorkerEntrypoint2(klass) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__2 === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__2.length === 0) {
    return klass;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__2) {
    __facade_register__2(middleware);
  }
  return class extends klass {
    #fetchDispatcher = /* @__PURE__ */ __name((request, env, ctx) => {
      this.env = env;
      this.ctx = ctx;
      if (super.fetch === void 0) {
        throw new Error("Entrypoint class does not define a fetch() function.");
      }
      return super.fetch(request);
    }, "#fetchDispatcher");
    #dispatcher = /* @__PURE__ */ __name((type, init) => {
      if (type === "scheduled" && super.scheduled !== void 0) {
        const controller = new __Facade_ScheduledController__2(
          Date.now(),
          init.cron ?? "",
          () => {
          }
        );
        return super.scheduled(controller);
      }
    }, "#dispatcher");
    fetch(request) {
      return __facade_invoke__2(
        request,
        this.env,
        this.ctx,
        this.#dispatcher,
        this.#fetchDispatcher
      );
    }
  };
}
__name(wrapWorkerEntrypoint2, "wrapWorkerEntrypoint");
var WRAPPED_ENTRY2;
if (typeof middleware_insertion_facade_default2 === "object") {
  WRAPPED_ENTRY2 = wrapExportedHandler2(middleware_insertion_facade_default2);
} else if (typeof middleware_insertion_facade_default2 === "function") {
  WRAPPED_ENTRY2 = wrapWorkerEntrypoint2(middleware_insertion_facade_default2);
}
var middleware_loader_entry_default2 = WRAPPED_ENTRY2;
export {
  __INTERNAL_WRANGLER_MIDDLEWARE__2 as __INTERNAL_WRANGLER_MIDDLEWARE__,
  middleware_loader_entry_default2 as default
};
//# sourceMappingURL=functionsWorker-0.4456670521216872.js.map
