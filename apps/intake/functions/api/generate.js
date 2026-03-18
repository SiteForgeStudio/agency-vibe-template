// apps/intake/functions/api/generate.js
import { SYSTEM_RULES, VIBE_GUIDE, ICON_LIST } from "./prompts.js";

/**
 * Cloudflare Pages Function
 * POST /api/generate
 *
 * Expected body:
 * {
 *   businessName: string,
 *   story: string,
 *   clientEmail?: string
 * }
 */
export async function onRequestPost({ request, env }) {
  try {
    const body = await request.json();

    const businessName = String(body.businessName || "").trim();
    const story = String(body.story || "").trim();
    const clientEmail = String(body.clientEmail || "").trim();

    if (!businessName || !story) {
      return json({ ok: false, error: "Missing businessName or story" }, 400);
    }

    // 1) AI generation (schema-locked prompt)
    const raw = await callAI_({ businessName, story, clientEmail }, env);

    // 2) Normalize/migrate into Master Schema shape
    let data = normalizeToMasterSchema_(raw, { businessName, story, clientEmail });

    // 3) Guarantee inspiration queries & minimum gallery content
    data = ensureInspirationQueries_(data);

    // 4) Validate contract (hard gate)
    const errors = validateMasterContract_(data);
    if (errors.length) {
      return json(
        {
          ok: false,
          error: "Schema contract failed",
          errors,
          hint: "Fix prompt/normalizer so output matches master schema paths (hero.image.image_search_query, gallery.items[], settings.cta_type, features[], etc).",
        },
        422
      );
    }

    // 5) Normalize slug last (ensures stable output for downstream)
    const clientSlug = normalizeSlug_(data?.brand?.slug || businessName);
    data.brand.slug = clientSlug;

    return json({ ok: true, client_slug: clientSlug, business_json: data }, 200);
  } catch (err) {
    return json({ ok: false, error: String(err?.message || err) }, 500);
  }
}

/* -----------------------------
   AI CALL (OpenAI Responses API)
------------------------------ */
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
- hero.image.image_search_query REQUIRED (4–8 words).
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
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: env.OPENAI_MODEL || "gpt-4.1-mini",
      input: [
        { role: "system", content: system },
        { role: "user", content: user }
      ],
      text: { format: { type: "json_object" } }
    }),
  });

  if (!res.ok) {
    const t = await res.text();
    throw new Error(`OpenAI error (${res.status}): ${t}`);
  }

  const data = await res.json();

  const text =
    data?.output?.[0]?.content?.find(c => c.type === "output_text")?.text ??
    data?.output_text ??
    null;

  if (!text) throw new Error("OpenAI returned no text output");

  try {
    return JSON.parse(text);
  } catch {
    throw new Error("OpenAI did not return valid JSON");
  }
}

/* -----------------------------
   NORMALIZE TO MASTER SCHEMA
------------------------------ */
function normalizeToMasterSchema_(raw, ctx) {
  const r = deepClone_(raw || {});
  const out = {};

  // intelligence (required)
  out.intelligence = {
    industry:
      r.intelligence?.industry ||
      r.brand?.industry ||
      r.industry ||
      "Service business",
    target_persona:
      r.intelligence?.target_persona ||
      r.intelligence?.target_audience ||
      r.target_persona ||
      "Customers seeking a premium provider",
    tone_of_voice:
      r.intelligence?.tone_of_voice ||
      r.tone_of_voice ||
      r.intelligence?.market_position ||
      "Premium, confident, trustworthy"
  };

  // strategy (toggles only; required at top-level by schema, fields optional)
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
    show_service_area: bool_(s.show_service_area, false),
  };

  // settings (required)
  const vibe =
    r.settings?.vibe ||
    r.strategy?.vibe ||
    "Modern Minimal";

  const ctaLink =
    r.settings?.cta_link ||
    r.strategy?.cta?.href ||
    "#contact";

  out.settings = {
    vibe,
    menu: normalizeMenu_(r.settings?.menu || r.strategy?.menu_links || r.menu || null),
    cta_text: r.settings?.cta_text || r.strategy?.cta?.text || "Get Started",
    cta_link: ctaLink,
    cta_type: inferCtaType_(r.settings?.cta_type, ctaLink),
    secondary_cta_text: r.settings?.secondary_cta_text || "",
    secondary_cta_link: r.settings?.secondary_cta_link || ""
  };

  // brand (required)
  out.brand = {
    name: r.brand?.name || ctx.businessName,
    slug: r.brand?.slug || normalizeSlug_(ctx.businessName),
    tagline: r.brand?.tagline || r.brand?.positioning || "Built for quality and trust.",
    email: r.brand?.email || ctx.clientEmail || "contact@example.com",
    phone: r.brand?.phone || "",
    office_address: r.brand?.office_address || "",
    objection_handle: r.brand?.objection_handle || ""
  };

  // hero (required)
  const heroQuery =
    r.hero?.image?.image_search_query ||
    r.hero?.background_image_search_query ||
    r.hero?.image_search_query ||
    null;

  out.hero = {
    headline: r.hero?.headline || r.hero?.title || `Welcome to ${out.brand.name}`,
    subtext: r.hero?.subtext || r.hero?.subheadline || r.hero?.subtitle || "A premium experience built around your needs.",
    image: {
      alt: r.hero?.image?.alt || r.hero?.image_alt || `${out.intelligence.industry} hero image`,
      image_search_query: heroQuery || ""
    }
  };

  // about (required by schema even if strategy.show_about is false)
  out.about = {
    story_text: r.about?.story_text || r.about?.content || r.about?.story || ctx.story || "",
    founder_note: r.about?.founder_note || "Crafted with care and pride.",
    years_experience: r.about?.years_experience || "10+"
  };

  // trustbar (optional schema block)
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

  // features (required)
  out.features = normalizeFeatures_(r.features);

  // gallery (recommended; must exist if show_gallery true so images pipeline can inspire)
  out.gallery = normalizeGallery_(r.gallery, out.strategy.show_gallery, out.intelligence?.industry, out.settings?.vibe);

  // contact (required)
  out.contact = {
    headline: r.contact?.headline || "Get in Touch",
    subheadline: r.contact?.subheadline || r.contact?.content || "Tell us what you need and we’ll respond quickly.",
    email: r.contact?.email || out.brand.email,
    phone: r.contact?.phone || out.brand.phone,
    email_recipient: r.contact?.email_recipient || out.brand.email,
    button_text: r.contact?.button_text || r.contact?.submit_text || "Send Message",
    office_address: r.contact?.office_address || out.brand.office_address
  };

  // Optional blocks (only pass through if they already match schema-ish)
  // events, service_area, processSteps, testimonials, comparison, investment, faqs
  // Leave out unless you’ve explicitly normalized them later.

  return out;
}

/* -----------------------------
   ENSURE INSPIRATION QUERIES
------------------------------ */
function ensureInspirationQueries_(data) {
  // HERO query guarantee (4–8 words broad/visual)
  if (!data?.hero?.image?.image_search_query) {
    const industry = String(data?.intelligence?.industry || "service").toLowerCase();
    data.hero.image.image_search_query = clampWords_(
      `${industry} professional work in progress`,
      4,
      8
    );
  }

  // If gallery should show, ensure gallery structure + queries
  if (data?.strategy?.show_gallery) {
    data.gallery = data.gallery || { enabled: true, items: [] };
    data.gallery.enabled = true;

    if (!Array.isArray(data.gallery.items)) data.gallery.items = [];

    const count = Number(
      data.gallery.computed_count ||
      data.gallery.items.length ||
      6
    );

    const baseSubject = String(data?.intelligence?.industry || "service");
    const vibe = String(data?.settings?.vibe || "");
    const fallbackBase = `${baseSubject} results showcase ${vibe}`.trim();

    // Ensure enough items, but respect any intentional upstream item count first
    while (data.gallery.items.length < count) {
      data.gallery.items.push({
        title: `Project ${data.gallery.items.length + 1}`,
        image_search_query: ""
      });
    }

    data.gallery.items = data.gallery.items.map((it, i) => {
      const title = String(it?.title || `Project ${i + 1}`);
      const q = String(it?.image_search_query || "").trim();

      return {
        ...it,
        title,
        image_search_query: q || clampWords_(`${fallbackBase} ${i + 1}`, 4, 8)
      };
    });

    if (!data.gallery.image_source || typeof data.gallery.image_source !== "object") {
      data.gallery.image_source = {};
    }

    if (!String(data.gallery.image_source.image_search_query || "").trim()) {
      data.gallery.image_source.image_search_query =
        data.gallery.items[0]?.image_search_query ||
        clampWords_(fallbackBase, 4, 8);
    }
  } else {
    if (data.gallery) data.gallery.enabled = Boolean(data.gallery.enabled);
  }

  return data;
}

/* -----------------------------
   CONTRACT VALIDATION (NO DEPS)
------------------------------ */
function validateMasterContract_(data) {
  const errors = [];
  const reqTop = ["intelligence","strategy","settings","brand","hero","about","features","contact"];
  for (const k of reqTop) if (!data?.[k]) errors.push(`Missing top-level "${k}"`);

  // intelligence
  for (const k of ["industry","target_persona","tone_of_voice"]) {
    if (!data?.intelligence?.[k]) errors.push(`Missing intelligence.${k}`);
  }

  // settings
  const vibes = new Set([
    "Midnight Tech","Zenith Earth","Vintage Boutique","Rugged Industrial",
    "Modern Minimal","Luxury Noir","Legacy Professional","Solar Flare"
  ]);
  if (!vibes.has(data?.settings?.vibe)) errors.push("settings.vibe must be one of allowed enum values");
  for (const k of ["cta_text","cta_link","cta_type"]) {
    if (!data?.settings?.[k]) errors.push(`Missing settings.${k}`);
  }

  if (!Array.isArray(data?.settings?.menu) || data.settings.menu.length === 0) {
    errors.push("settings.menu must be a non-empty array");
  } else {
    const allowedAnchors = new Set([
      "#home","#about","#features","#events","#process","#testimonials","#comparison",
      "#gallery","#investment","#faqs","#service-area","#contact"
    ]);
    data.settings.menu.forEach((m, i) => {
      if (!m?.label) errors.push(`settings.menu[${i}].label missing`);
      if (!allowedAnchors.has(m?.path)) errors.push(`settings.menu[${i}].path invalid: ${m?.path}`);
    });
  }

  // brand
  for (const k of ["name","tagline","email"]) {
    if (!data?.brand?.[k]) errors.push(`Missing brand.${k}`);
  }

  // hero
  for (const k of ["headline","subtext"]) {
    if (!data?.hero?.[k]) errors.push(`Missing hero.${k}`);
  }
  if (!data?.hero?.image?.alt) errors.push("Missing hero.image.alt");
  if (!data?.hero?.image?.image_search_query) errors.push("Missing hero.image.image_search_query");

  // about
  for (const k of ["story_text","founder_note","years_experience"]) {
    if (!data?.about?.[k]) errors.push(`Missing about.${k}`);
  }

  // features
  if (!Array.isArray(data?.features) || data.features.length < 3) {
    errors.push("features must be an array with at least 3 items");
  } else {
    data.features.forEach((f, i) => {
      for (const k of ["title","description","icon_slug"]) {
        if (!f?.[k]) errors.push(`features[${i}].${k} missing`);
      }
    });
  }

  // contact
  for (const k of ["headline","subheadline","email_recipient","button_text"]) {
    if (!data?.contact?.[k]) errors.push(`Missing contact.${k}`);
  }

  // gallery contract only when enabled by strategy
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

  // trustbar if present must match min shape (enabled + items)
  if (data?.trustbar) {
    if (typeof data.trustbar.enabled !== "boolean") errors.push("trustbar.enabled must be boolean");
    if (!Array.isArray(data.trustbar.items) || data.trustbar.items.length < 2) {
      errors.push("trustbar.items must have 2+ items when trustbar exists");
    }
  }

  return errors;
}

/* -----------------------------
   NORMALIZERS / HELPERS
------------------------------ */
function normalizeGallery_(g, showGallery, industry, vibe) {
  const gg = g || {};
  const enabled = Boolean(gg.enabled ?? showGallery);

  // Legacy support: gallery.images[] -> gallery.items[]
  let items = gg.items;
  if (!Array.isArray(items) && Array.isArray(gg.images)) {
    items = gg.images.map((im, i) => ({
      title: im.title || im.alt || `Project ${i + 1}`,
      image_search_query: im.image_search_query || ""
    }));
  }
  if (!Array.isArray(items)) items = [];

  // Inference defaults for computed_layout / computed_count
  const ind = String(industry || "").toLowerCase();
  const isLuxury = ind.includes("watch") || ind.includes("jewelry") || String(vibe || "") === "Luxury Noir";
  const isCreative = ind.includes("photo") || ind.includes("studio") || ind.includes("art");
  const isTrades = ind.includes("detailing") || ind.includes("plumbing") || ind.includes("construction") || ind.includes("trades") || ind.includes("service");

  const computed_layout =
    gg.computed_layout ||
    (isLuxury ? "bento" : isCreative ? "masonry" : isTrades ? "grid" : "grid");

  const computed_count =
    gg.computed_count ||
    items.length ||
    (isLuxury ? 5 : isCreative ? 9 : isTrades ? 6 : 6);

  return {
    enabled,
    title: gg.title || "Gallery",
    layout: gg.layout ?? null,
    show_titles: gg.show_titles ?? true,
    image_source: gg.image_source || {
      image_search_query: ""
    },
    computed_count: enabled ? computed_count : (gg.computed_count ?? null),
    computed_layout: enabled ? computed_layout : (gg.computed_layout ?? null),
    items
  };
}

function normalizeFeatures_(f) {
  if (Array.isArray(f) && f.length) {
    return f.map(x => ({
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

function normalizeTrustbar_(t) {
  const tt = t || {};
  let items = tt.items;
  if (!Array.isArray(items) && Array.isArray(tt.points)) {
    items = tt.points.map(p => ({ icon: p.icon || "check", label: p.text || "" }));
  }
  if (!Array.isArray(items)) items = [];
  return {
    enabled: Boolean(tt.enabled ?? true),
    headline: tt.headline || "Why Choose Us",
    items: items.slice(0, 8).map(it => ({
      icon: it.icon || "check",
      label: it.label || it.text || "",
      sublabel: it.sublabel || ""
    }))
  };
}

function normalizeMenu_(menuLike) {
  const fallback = [
    { label: "Home", path: "#home" },
    { label: "About", path: "#about" },
    { label: "Features", path: "#features" },
    { label: "Gallery", path: "#gallery" },
    { label: "Contact", path: "#contact" }
  ];

  if (!Array.isArray(menuLike) || !menuLike.length) return fallback;

  const allowed = new Set([
    "#home","#about","#features","#events","#process","#testimonials","#comparison",
    "#gallery","#investment","#faqs","#service-area","#contact"
  ]);

  const mapped = menuLike.map(m => ({
    label: String(m?.label || m?.name || "Link").trim() || "Link",
    path: String(m?.path || m?.href || "#contact").trim() || "#contact"
  }));

  return mapped.map(m => ({
    label: m.label,
    path: allowed.has(m.path) ? m.path : "#contact"
  }));
}

function inferCtaType_(ctaType, link) {
  if (ctaType === "anchor" || ctaType === "external") return ctaType;
  return String(link || "").startsWith("#") ? "anchor" : "external";
}

function clampWords_(text, min, max) {
  const words = String(text || "").trim().split(/\s+/).filter(Boolean);
  if (words.length <= max && words.length >= min) return words.join(" ");
  if (words.length > max) return words.slice(0, max).join(" ");
  const pad = ["photography","professional","high","quality","detail"];
  while (words.length < min && pad.length) words.push(pad.shift());
  return words.slice(0, max).join(" ");
}

function bool_(v, dflt) {
  return typeof v === "boolean" ? v : dflt;
}

function normalizeSlug_(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/'/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function deepClone_(x) {
  return JSON.parse(JSON.stringify(x));
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}