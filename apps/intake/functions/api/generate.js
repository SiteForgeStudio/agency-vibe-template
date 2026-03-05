import Ajv from "ajv";
import schema from "../../schema/master-schema.json"; // adjust path if needed
import { SYSTEM_RULES, VIBE_GUIDE, ICON_LIST } from "./prompts.js";

const ajv = new Ajv({ allErrors: true, strict: false });
const validate = ajv.compile(schema);

export async function onRequestPost({ request, env }) {
  try {
    const body = await request.json();
    const businessName = String(body.businessName || "").trim();
    const story = String(body.story || "").trim();
    const clientEmail = String(body.clientEmail || "").trim();

    if (!businessName || !story) {
      return json({ ok: false, error: "Missing businessName or story" }, 400);
    }

    const raw = await callAI_({ businessName, story, clientEmail }, env);

    // 1) Normalize/migrate common drift → master schema shape
    let data = normalizeToMasterSchema_(raw, { businessName, story, clientEmail });

    // 2) Enforce inspiration invariants (queries/items)
    data = ensureInspirationQueries_(data);

    // 3) Validate hard
    const ok = validate(data);
    if (!ok) {
      return json({
        ok: false,
        error: "Schema validation failed",
        validation_errors: (validate.errors || []).map(e => ({
          path: e.instancePath,
          message: e.message,
          keyword: e.keyword,
        })),
      }, 422);
    }

    // slug normalization
    const clientSlug = normalizeSlug_(data.brand?.slug || businessName);
    data.brand.slug = clientSlug;

    return json({ ok: true, client_slug: clientSlug, business_json: data });
  } catch (err) {
    return json({ ok: false, error: String(err?.message || err) }, 500);
  }
}

/** Deterministic migration into master schema */
function normalizeToMasterSchema_(raw, ctx) {
  const r = JSON.parse(JSON.stringify(raw || {}));
  const out = {};

  // --- intelligence (required) ---
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
      "Customers looking for a premium local provider",
    tone_of_voice:
      r.intelligence?.tone_of_voice ||
      r.tone_of_voice ||
      r.intelligence?.market_position ||
      "Premium, trustworthy, direct"
  };

  // --- strategy (toggles) ---
  // accept drift where toggles might be missing; default sensible values
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

  // --- settings (required) ---
  const vibe =
    r.settings?.vibe ||
    r.strategy?.vibe ||
    "Modern Minimal";

  out.settings = {
    vibe: vibe,
    menu: normalizeMenu_(r.settings?.menu || r.strategy?.menu_links || r.menu || null),
    cta_text: r.settings?.cta_text || r.strategy?.cta?.text || "Get Started",
    cta_link: r.settings?.cta_link || r.strategy?.cta?.href || "#contact",
    cta_type: inferCtaType_(r.settings?.cta_type, r.settings?.cta_link || r.strategy?.cta?.href || "#contact"),
    secondary_cta_text: r.settings?.secondary_cta_text || "",
    secondary_cta_link: r.settings?.secondary_cta_link || ""
  };

  // --- brand (required) ---
  out.brand = {
    name: r.brand?.name || ctx.businessName,
    slug: r.brand?.slug || normalizeSlug_(ctx.businessName),
    tagline: r.brand?.tagline || r.brand?.positioning || "Built for quality and trust.",
    email: r.brand?.email || ctx.clientEmail || "contact@example.com",
    phone: r.brand?.phone || "",
    office_address: r.brand?.office_address || "",
    objection_handle: r.brand?.objection_handle || ""
  };

  // --- hero (required) ---
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
      image_search_query: heroQuery || "" // filled by ensureInspirationQueries_
    }
  };

  // --- about (required) ---
  out.about = {
    story_text: r.about?.story_text || r.about?.content || r.about?.story || ctx.story || "",
    founder_note: r.about?.founder_note || "Crafted with care and pride.",
    years_experience: r.about?.years_experience || "10+"
  };

  // --- trustbar (optional but schema-defined) ---
  if (r.trustbar) {
    out.trustbar = normalizeTrustbar_(r.trustbar);
  } else if (out.strategy.show_trustbar) {
    out.trustbar = {
      enabled: true,
      headline: "Why Choose Us",
      items: [
        { icon: "award", label: "Pro-grade quality" },
        { icon: "shield", label: "Trusted and insured" },
        { icon: "clock", label: "On-time delivery" }
      ]
    };
  }

  // --- features (required) ---
  out.features = normalizeFeatures_(r.features);

  // --- gallery (optional but used when show_gallery true) ---
  out.gallery = normalizeGallery_(r.gallery, out.strategy.show_gallery);

  // --- contact (required) ---
  out.contact = {
    headline: r.contact?.headline || "Get in Touch",
    subheadline: r.contact?.subheadline || r.contact?.content || "Tell us what you need and we’ll respond quickly.",
    email: r.contact?.email || out.brand.email,
    phone: r.contact?.phone || out.brand.phone,
    email_recipient: r.contact?.email_recipient || out.brand.email,
    button_text: r.contact?.button_text || r.contact?.submit_text || "Send Message",
    office_address: r.contact?.office_address || out.brand.office_address
  };

  return out;
}

function ensureInspirationQueries_(data) {
  // HERO query guarantee
  if (!data.hero?.image?.image_search_query) {
    const industry = (data.intelligence?.industry || "service").toLowerCase();
    // 4–8 words, broad context, no locations
    data.hero.image.image_search_query =
      `${industry} professional service in action`.split(" ").slice(0, 8).join(" ");
  }

  // GALLERY guarantee
  const wantsGallery = Boolean(data.strategy?.show_gallery);
  if (wantsGallery) {
    data.gallery = data.gallery || { enabled: true, items: [] };
    data.gallery.enabled = true;

    const count = data.gallery.computed_count || 6;
    const base = `${(data.intelligence?.industry || "service")} work showcase`.trim();

    // ensure items exist
    if (!Array.isArray(data.gallery.items)) data.gallery.items = [];
    while (data.gallery.items.length < count) {
      data.gallery.items.push({
        title: `Project ${data.gallery.items.length + 1}`,
        image_search_query: ""
      });
    }

    data.gallery.items = data.gallery.items.map((it, i) => ({
      ...it,
      title: it.title || `Project ${i + 1}`,
      image_search_query: it.image_search_query || `${base} ${i + 1}`.slice(0, 80)
    }));
  }

  return data;
}

function normalizeGallery_(g, showGallery) {
  const gg = g || {};
  const enabled = Boolean(gg.enabled ?? showGallery);

  // support legacy: gallery.images[] → gallery.items[]
  let items = gg.items;
  if (!Array.isArray(items) && Array.isArray(gg.images)) {
    items = gg.images.map((im, i) => ({
      title: im.title || im.alt || `Project ${i + 1}`,
      image_search_query: im.image_search_query || ""
    }));
  }
  if (!Array.isArray(items)) items = [];

  return {
    enabled,
    title: gg.title || "Gallery",
    layout: gg.layout ?? null,
    show_titles: gg.show_titles ?? true,
    computed_count: gg.computed_count ?? (enabled ? 6 : null),
    computed_layout: gg.computed_layout ?? (enabled ? "grid" : null),
    items
  };
}

function normalizeFeatures_(f) {
  if (Array.isArray(f) && f.length) return f.map(x => ({
    title: x.title || "Feature",
    description: x.description || "",
    icon_slug: x.icon_slug || x.icon || "sparkles"
  }));

  // safe default (features is required)
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
    items: items.slice(0, 8)
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

  // support legacy: {name, href}
  const mapped = menuLike.map(m => ({
    label: m.label || m.name || "Link",
    path: m.path || m.href || "#contact"
  }));

  // enforce allowed anchors (schema enum)
  const allowed = new Set([
    "#home","#about","#features","#events","#process","#testimonials","#comparison",
    "#gallery","#investment","#faqs","#service-area","#contact"
  ]);

  return mapped.map(m => ({
    label: String(m.label || "").trim() || "Link",
    path: allowed.has(m.path) ? m.path : "#contact"
  }));
}

function inferCtaType_(ctaType, link) {
  if (ctaType === "anchor" || ctaType === "external") return ctaType;
  return String(link || "").startsWith("#") ? "anchor" : "external";
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
function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}