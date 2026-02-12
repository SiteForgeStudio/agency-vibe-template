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
  
  async function openaiJson({ model, messages, temperature = 0.3 }) {
    const apiKey = process.env.OPENAI_API_KEY;
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
  
  /* =========================
     Schema adapter (fixes key names + required fields)
  ========================= */
  
  function toMenuObjects(menuPaths) {
    const labelMap = {
      "#home": "Home",
      "#about": "About",
      "#features": "Services",
      "#events": "Schedule",
      "#process": "Process",
      "#testimonials": "Reviews",
      "#comparison": "Compare",
      "#gallery": "Gallery",
      "#investment": "Pricing",
      "#faqs": "FAQ",
      "#service-area": "Service Area",
      "#contact": "Contact",
    };
  
    return (menuPaths || [])
      .filter(Boolean)
      .map((p) => ({ label: labelMap[p] || "Section", path: p }));
  }
  
  function ensureStrategyBooleans(strategy = {}) {
    const out = {
      show_trustbar: false,
      show_about: true,
      show_features: true,
      show_events: false,
      show_process: true,
      show_testimonials: true,
      show_comparison: false,
      show_gallery: false,
      show_investment: false,
      show_faqs: true,
      show_service_area: true,
      ...strategy,
    };
    for (const k of Object.keys(out)) out[k] = Boolean(out[k]);
    return out;
  }
  
  function adaptToSchema({ draft, input, plan }) {
    const site_for = input.site_for || "";
    const tone_hint = input.tone_hint || "";
    const goal = input.goal || "Contact";
  
    // Menu paths may be strings from older outputs; prefer plan.settings.menu then plan.strategy.menu
    const menuPaths =
      plan?.settings?.menu ||
      plan?.strategy?.menu ||
      draft?.settings?.menu ||
      draft?.strategy?.menu ||
      ["#home", "#about", "#features", "#process", "#faqs", "#service-area", "#contact"];
  
    // Settings CTA
    let cta_link = "#contact";
    let cta_type = "anchor";
    let cta_text =
      goal === "Call" ? "Call Now" : goal === "Quote" ? "Request a Quote" : goal === "Book" ? "Book Now" : "Contact Us";
  
    // If you later support booking URLs in intake, set cta_type="external" and cta_link=<url>.
    // For now, always anchor to contact.
    if (goal === "Call" && !(draft?.brand?.phone || input.phone)) {
      cta_text = "Contact Us";
      cta_link = "#contact";
      cta_type = "anchor";
    }
  
    // Intelligence (required by schema)
    const industry =
      draft?.intelligence?.industry ||
      (site_for.toLowerCase().includes("detailing")
        ? "mobile car detailing"
        : site_for
        ? site_for
        : "local services");
  
    const target_persona =
      draft?.intelligence?.target_persona ||
      "Local customers who want a reliable, high-quality service";
  
    const tone_of_voice =
      draft?.intelligence?.tone_of_voice ||
      (tone_hint ? tone_hint : "Professional, friendly, and clear");
  
    const settings = {
      vibe: draft?.settings?.vibe || plan?.settings?.vibe || "Modern Minimal",
      cta_text,
      cta_link,
      cta_type,
      menu: toMenuObjects(menuPaths),
    };
  
    // Strategy booleans (required by engine logic)
    const strategy = ensureStrategyBooleans(draft?.strategy || plan?.strategy || {});
  
    // Brand (schema-required: name, tagline, email)
    const brand = {
      name: draft?.brand?.name || input.business_name || "Your Business",
      slug: draft?.brand?.slug || "",
      tagline:
        draft?.brand?.tagline ||
        `Trusted ${industry}${input.main_city ? ` in ${input.main_city}` : ""}`,
      email: draft?.brand?.email || input.email || "",
      phone: draft?.brand?.phone || input.phone || "",
      office_address: draft?.brand?.office_address || "",
      objection_handle: draft?.brand?.objection_handle || "",
    };
  
    // Hero (schema-required: headline, subtext, image)
    const hero = {
      headline: draft?.hero?.headline || "Premium service, made easy",
      subtext:
        draft?.hero?.subtext ||
        draft?.hero?.subheadline ||
        draft?.hero?.subheadline ||
        "Fast, simple, and professional from first contact to completion.",
      image: draft?.hero?.image || {
        alt: "Service professional at work",
        image_search_query: "service professional working outdoors",
      },
    };
  
    // About (schema-required: story_text, founder_note, years_experience)
    const aboutText =
      draft?.about?.story_text ||
      draft?.about?.content ||
      "We’re built around quality work, clear communication, and a great customer experience.";
  
    const about = {
      story_text: aboutText,
      founder_note: draft?.about?.founder_note || "Owner-led, detail-focused, and committed to doing it right.",
      years_experience: draft?.about?.years_experience || "Newly launched",
    };
  
    // Features (schema critical: array of items with title/description/icon_slug)
    let features = Array.isArray(draft?.features) ? draft.features : [];
    if (features.length < 3) {
      features = [
        ...features,
        { title: "Easy scheduling", description: "Fast replies and simple booking.", icon_slug: "clock" },
        { title: "Quality-first work", description: "Careful, consistent results you can trust.", icon_slug: "check" },
        { title: "Friendly support", description: "Clear communication from start to finish.", icon_slug: "phone" },
      ].slice(0, 3);
    }
  
    // Contact (schema required: headline, subheadline, email_recipient, button_text)
    const contact = {
      headline: draft?.contact?.headline || "Get in touch",
      subheadline: draft?.contact?.subheadline || "Tell us what you need and we’ll respond shortly.",
      email_recipient: draft?.contact?.email_recipient || brand.email,
      button_text: draft?.contact?.button_text || settings.cta_text,
      email: draft?.contact?.email || brand.email,
      phone: draft?.contact?.phone || brand.phone,
      office_address: draft?.contact?.office_address || brand.office_address,
    };
  
    // Optional service area (only if strategy says so)
    const out = {
      intelligence: { industry, target_persona, tone_of_voice },
      strategy,
      settings,
      brand,
      hero,
      about,
      features,
      contact,
    };
  
    if (strategy.show_service_area) {
      out.service_area = {
        main_city: input.main_city || "Our Region",
        surrounding_cities: [],
        travel_note: "Outside these areas? We offer custom quotes for extended travel.",
        cta_text: settings.cta_text,
        cta_link: settings.cta_link,
      };
    }
  
    // Optional events (only if enabled and we have 3+ items)
    if (strategy.show_events && Array.isArray(draft?.events) && draft.events.length >= 3) {
      out.events = draft.events;
    } else {
      // Ensure show_events can't be true without events
      out.strategy.show_events = false;
    }
  
    return out;
  }
  
  /* =========================
     Netlify Function
  ========================= */
  
  export default async (req) => {
    try {
      const input = await req.json();
  
      const site_for = input.site_for || "";
      const business_name = input.business_name || "";
      const email = input.email || "";
      const phone = input.phone || "";
      const main_city = input.main_city || "";
      const goal = input.goal || "Contact";
      const tone_hint = input.tone_hint || "";
  
      // Pass A: Architect
      const plan = await openaiJson({
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
  - settings.menu must be a list of anchor paths from:
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
  
      // Pass B: Builder (draft may not match schema exactly — adapter fixes)
      const draft = await openaiJson({
        model: "gpt-4.1-mini",
        temperature: 0.4,
        messages: [
          {
            role: "user",
            content: `
  You are SiteForge "Builder".
  Return ONE JSON object that includes these keys:
  intelligence, strategy, settings, brand, hero, about, features, contact
  
  Hard rules:
  - Do NOT invent awards/certs/years/pricing unless user provided.
  - features: 3–8 items with title, description, icon_slug.
    icon_slug must be one of:
    zap,cpu,layers,rocket,leaf,sprout,sun,scissors,truck,hammer,wrench,trash,sparkles,heart,award,users,map,shield,star,check,coins,briefcase,clock,phone
  - hero.image: alt + image_search_query (4–8 words: subject action context).
  - contact must include headline, subheadline, email_recipient, button_text.
  
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
  
      must(draft, ["intelligence", "strategy", "settings", "brand", "hero", "about", "features", "contact"]);
  
      // Lock slug and adapt to CURRENT master schema
      const slug = normalizeSlug(draft?.brand?.slug || draft?.brand?.name || business_name || "brand");
      const business_json = adaptToSchema({ draft, input, plan });
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
  };
  