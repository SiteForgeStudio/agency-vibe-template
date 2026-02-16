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

    // Pass A: Architect
    const plan = await openaiJson({
      apiKey: env.OPENAI_API_KEY,
      model: "gpt-4.1-mini",
      temperature: 0.3,
      messages: [
        {
          role: "user",
          content: `
You are SiteForge "Architect".
Return JSON ONLY with keys: intelligence, strategy, settings.

Rules:
- settings.vibe must be one of:
  "Midnight Tech","Zenith Earth","Vintage Boutique","Rugged Industrial","Modern Minimal","Luxury Noir","Legacy Professional","Solar Flare"
- settings.menu paths must be valid anchors from:
  #home,#about,#features,#events,#process,#testimonials,#comparison,#gallery,#investment,#faqs,#service-area,#contact
- Always include #home and #contact.
- show_events only if you can populate 3+ events items later; otherwise false.

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

    // Pass B: Builder
    const business_json = await openaiJson({
      apiKey: env.OPENAI_API_KEY,
      model: "gpt-4.1-mini",
      temperature: 0.4,
      messages: [
        {
          role: "user",
          content: `
You are SiteForge "Builder".
Return ONE JSON object that matches this required top-level shape:
intelligence, strategy, settings, brand, hero, about, features, contact, service_area

Hard rules:
- Do NOT invent awards/certs/years/pricing unless user provided.
- features: 3–8 items with title, description, icon_slug.
  icon_slug must be one of:
  zap,cpu,layers,rocket,leaf,sprout,sun,scissors,truck,hammer,wrench,trash,sparkles,heart,award,users,map,shield,star,check,coins,briefcase,clock,phone
- hero.image: alt + image_search_query (4–8 words: subject action context). Do NOT include city names in the image_search_query.
- contact must include headline, subheadline, email_recipient, button_text.
- about must be present even if strategy.show_about is false (safe generic copy allowed).
- If strategy.show_service_area is true, include service_area with main_city and 3–8 surrounding_cities.

Plan (must follow):
${JSON.stringify(plan)}

Authoritative facts from user:
business_name: ${JSON.stringify(business_name)}
email: ${JSON.stringify(email)}
phone: ${JSON.stringify(phone)}
main_city: ${JSON.stringify(main_city)}
goal: ${JSON.stringify(goal)}
site_for: ${JSON.stringify(site_for)}

JSON ONLY. No markdown.
          `.trim(),
        },
      ],
    });

    must(business_json, ["intelligence", "strategy", "settings", "brand", "hero", "about", "features", "contact"]);

    // Lock slug
    const slug = normalizeSlug(business_json?.brand?.slug || business_json?.brand?.name || business_name || "brand");
    business_json.brand = business_json.brand || {};
    business_json.brand.slug = slug;

    // Ensure email/phone are present in brand if provided
    if (email && !business_json.brand.email) business_json.brand.email = email;
    if (phone && !business_json.brand.phone) business_json.brand.phone = phone;

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
