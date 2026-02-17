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

function isObj(v) {
  return v && typeof v === "object" && !Array.isArray(v);
}

function labelForAnchor(a) {
  return (
    (a === "#home" && "Home") ||
    (a === "#about" && "About") ||
    (a === "#features" && "Services") ||
    (a === "#events" && "Schedule") ||
    (a === "#process" && "Process") ||
    (a === "#testimonials" && "Reviews") ||
    (a === "#comparison" && "Compare") ||
    (a === "#gallery" && "Gallery") ||
    (a === "#investment" && "Pricing") ||
    (a === "#faqs" && "FAQ") ||
    (a === "#service-area" && "Service Area") ||
    (a === "#contact" && "Contact") ||
    "Link"
  );
}

function normalizeMenu(menuLike) {
  // schema requires [{label,path}]
  if (!menuLike) return null;

  if (Array.isArray(menuLike) && menuLike.length > 0) {
    const first = menuLike[0];

    // already objects
    if (isObj(first) && "label" in first && "path" in first) {
      return menuLike.map((m) => ({
        label: String(m.label || labelForAnchor(m.path)),
        path: String(m.path),
      }));
    }

    // anchor strings
    if (typeof first === "string") {
      return menuLike.map((a) => ({ label: labelForAnchor(a), path: a }));
    }
  }

  return null;
}

function normalizeOutputToSchema(raw, input) {
  // Fix common drift fields so components always get what they expect.
  const out = { ...(raw || {}) };

  // intelligence
  if (raw?.intelligence && !raw.intelligence.industry) {
    out.intelligence = {
      industry: raw.intelligence.business_type || raw.intelligence.industry || input.site_for || "service business",
      target_persona: raw.intelligence.target_audience || raw.intelligence.target_persona || "local customers",
      tone_of_voice: raw.intelligence.tone || raw.intelligence.tone_of_voice || input.tone_hint || "professional",
    };
  }

  // settings.menu normalize
  if (raw?.settings) {
    out.settings = { ...raw.settings };
    const nm = normalizeMenu(raw.settings.menu) || normalizeMenu(raw?.strategy?.menu);
    if (nm) out.settings.menu = nm;
  }

  // hero subheadline -> subtext
  if (raw?.hero) {
    out.hero = { ...raw.hero };
    if (!out.hero.subtext && out.hero.subheadline) out.hero.subtext = out.hero.subheadline;
    delete out.hero.subheadline;
  }

  // about content/headline -> required keys
  if (raw?.about) {
    out.about = { ...raw.about };
    if (!out.about.story_text && (out.about.content || out.about.story)) out.about.story_text = out.about.content || out.about.story;
    if (!out.about.founder_note) out.about.founder_note = "Owner-led and detail-focused.";
    if (!out.about.years_experience) out.about.years_experience = "Newly launched";
    delete out.about.headline;
    delete out.about.content;
  }

  // contact: ensure schema keys exist
  if (raw?.contact) {
    out.contact = { ...raw.contact };
    if (!out.contact.subheadline && out.contact.subtext) out.contact.subheadline = out.contact.subtext;
    delete out.contact.subtext;
  }

  // service_area key name
  if (raw?.serviceArea && !raw?.service_area) {
    out.service_area = raw.serviceArea;
    delete out.serviceArea;
  }

  return out;
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

    const site_for = input.site_for || "";
    const business_name = input.business_name || "";
    const email = input.email || "";
    const phone = input.phone || "";
    const main_city = input.main_city || "";
    const goal = input.goal || "Contact";
    const tone_hint = input.tone_hint || "";

    // Pass A: Architect (force MASTER schema shape)
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

MASTER SCHEMA SHAPES (MUST MATCH):
- intelligence: { "industry": string, "target_persona": string, "tone_of_voice": string }
- strategy: include ALL booleans:
  show_trustbar,show_about,show_features,show_events,show_process,show_testimonials,show_comparison,show_gallery,show_investment,show_faqs,show_service_area
- settings: { vibe, cta_text, cta_link, cta_type, menu }
  menu MUST be an array of objects: [{ "label": string, "path": anchor }]
  path MUST be one of:
  #home,#about,#features,#events,#process,#testimonials,#comparison,#gallery,#investment,#faqs,#service-area,#contact

Rules:
- vibe must be one of:
  "Midnight Tech","Zenith Earth","Vintage Boutique","Rugged Industrial","Modern Minimal","Luxury Noir","Legacy Professional","Solar Flare"
- Always include #home and #contact in menu.
- show_events only if you can populate 3+ events later; otherwise false.
- cta_type should be "anchor" unless you have a real external booking URL.

User input:
site_for: ${JSON.stringify(site_for)}
business_name: ${JSON.stringify(business_name)}
goal: ${JSON.stringify(goal)}
tone_hint: ${JSON.stringify(tone_hint)}
main_city: ${JSON.stringify(main_city)}
          `.trim(),
        },
      ],
    });

    must(plan, ["intelligence", "strategy", "settings"]);

    // Pass B: Builder (force EXACT master schema output)
    const raw = await openaiJson({
      apiKey: env.OPENAI_API_KEY,
      model: "gpt-4.1-mini",
      temperature: 0.35,
      messages: [
        {
          role: "user",
          content: `
You are SiteForge "Builder".
Return ONE JSON object that matches the MASTER SCHEMA EXACTLY.

REQUIRED top-level keys:
intelligence, strategy, settings, brand, hero, about, features, contact

OPTIONAL keys (only if relevant):
service_area (include ONLY if strategy.show_service_area is true)

MASTER SCHEMA (MUST MATCH):
- intelligence: { industry, target_persona, tone_of_voice }
- strategy: include ALL show_* booleans listed in plan.strategy
- settings: { vibe, cta_text, cta_link, cta_type, secondary_cta_text, secondary_cta_link, menu }
  menu MUST be [{label, path}] not strings
- brand: { name, slug, tagline, email, phone, office_address, objection_handle }
- hero: { headline, subtext, image:{alt,image_search_query} }
  image_search_query must be 4–8 words, DO NOT include city names
- about: { story_text, founder_note, years_experience }
  Do NOT invent years; if unknown use "Newly launched"
- features: 3–8 items { title, description, icon_slug } using allowed icon slugs
- contact: { headline, subheadline, email_recipient, button_text, email, phone, office_address }

Hard rules:
- Do NOT invent awards/certs/pricing.
- Use user-provided email/phone.
- Keep copy "premium but friendly" when appropriate.
- JSON ONLY. No markdown.

Architect plan:
${JSON.stringify(plan)}

Authoritative facts:
business_name: ${JSON.stringify(business_name)}
email: ${JSON.stringify(email)}
phone: ${JSON.stringify(phone)}
main_city: ${JSON.stringify(main_city)}
goal: ${JSON.stringify(goal)}
site_for: ${JSON.stringify(site_for)}
          `.trim(),
        },
      ],
    });

    const business_json = normalizeOutputToSchema(raw, {
      site_for,
      business_name,
      email,
      phone,
      main_city,
      goal,
      tone_hint,
    });

    must(business_json, ["intelligence", "strategy", "settings", "brand", "hero", "about", "features", "contact"]);

    // Lock slug
    const slug = normalizeSlug(business_json?.brand?.slug || business_json?.brand?.name || business_name || "brand");
    business_json.brand = business_json.brand || {};
    business_json.brand.slug = slug;

    // Ensure email/phone are present in brand if provided
    if (email && !business_json.brand.email) business_json.brand.email = email;
    if (phone && !business_json.brand.phone) business_json.brand.phone = phone;

    // If show_service_area true but missing, add a minimal one
    if (business_json?.strategy?.show_service_area && !business_json.service_area) {
      business_json.service_area = {
        main_city: main_city || "Our Region",
        surrounding_cities: [],
        travel_note: "Outside these areas? We offer custom quotes for extended travel.",
        cta_text: business_json.settings?.cta_text || "Contact Us",
        cta_link: "#contact",
        map_search_query: "",
      };
    }

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
