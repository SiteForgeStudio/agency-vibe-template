function json(data, status = 200) {
    return new Response(JSON.stringify(data, null, 2), {
      status,
      headers: {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "no-store"
      }
    });
  }
  
  function extractJsonObject(text) {
    const raw = String(text || "").trim();
  
    if (!raw) {
      throw new Error("AI returned empty content");
    }
  
    try {
      return JSON.parse(raw);
    } catch {}
  
    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}");
  
    if (start === -1 || end === -1 || end <= start) {
      throw new Error("AI did not return valid JSON");
    }
  
    return JSON.parse(raw.slice(start, end + 1));
  }

  /** If the model ignores instructions, never persist not_found when a real website exists. */
  function coerceGbpWhenWebsitePresent(parsed, websiteHint) {
    const w = String(websiteHint || "").trim();
    if (!/^https?:\/\//i.test(w)) return;
    if (parsed.gbp_status !== "not_found") return;
    parsed.gbp_status = "unclear";
    const note =
      "Automated inference only: a website URL was provided; a GBP may exist or need claiming—live Maps verification was not performed.";
    parsed.notes = [parsed.notes, note].filter(Boolean).join(" ");
    const c = Number(parsed.listing_confidence);
    parsed.listing_confidence =
      Number.isFinite(c) ? Math.max(c, 0.38) : 0.4;
  }
  
  export async function onRequest(context) {
    const { request, env } = context;
  
    if (request.method !== "POST") {
      return json({ ok: false, error: "Use POST /api/preflight-gbp" }, 405);
    }
  
    try {
      const body = await request.json();
      const slug = String(body.slug || "").trim();
  
      if (!slug) {
        return json({ ok: false, error: "Missing slug" }, 400);
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
  
      // 1) Load current preflight data
      const statusRes = await fetch(new URL("/api/preflight-status", request.url), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ slug })
      });
  
      const status = await statusRes.json();
  
      if (!statusRes.ok || !status.ok) {
        return json(
          {
            ok: false,
            error: status?.error || "Failed to load preflight status",
            slug
          },
          statusRes.status || 404
        );
      }

      const websiteHint = String(
        status.optional_website_or_social ??
          status.client?.optional_website_or_social ??
          status.website_or_social ??
          ""
      ).trim();
  
      // 2) Ask AI for GBP-oriented audit/creation plan
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
- If a real http(s) website URL is provided below for this business, treat it as evidence the business likely has or could claim a legitimate online footprint—including a GBP that may exist under a slightly different name or that needs claiming/merging.
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
- If a website URL is provided, "not_found" is almost always wrong—use "unclear" or "likely_exists" instead
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
        return json(
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
  
      // 3) Persist GBP audit to Apps Script
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
      return json(
        {
          ok: false,
          error: String(err?.message || err)
        },
        500
      );
    }
  }