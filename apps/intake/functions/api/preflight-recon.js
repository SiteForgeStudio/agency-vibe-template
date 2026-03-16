// apps/intake/functions/api/preflight-recon.js

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
  
    // First try direct parse
    try {
      return JSON.parse(raw);
    } catch {}
  
    // Fallback: extract first JSON object block
    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}");
  
    if (start === -1 || end === -1 || end <= start) {
      throw new Error("AI did not return valid JSON");
    }
  
    const sliced = raw.slice(start, end + 1);
    return JSON.parse(sliced);
  }
  
  export async function onRequest(context) {
    const { request, env } = context;
  
    if (request.method !== "POST") {
      return json({ ok: false, error: "Use POST /api/preflight-recon" }, 405);
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
  
      // 1) Load preflight record from your existing status route
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
  
      // 2) Dedicated recon prompt with dedicated response shape
      const prompt = `
  You are an expert local business strategist for SiteForge Factory.
  
  Your job:
  Infer a first-pass strategic recon profile for a business before the paid intake begins.
  
  Business name:
  ${status.input_business_name}
  
  Location / service area:
  ${status.city_or_service_area_input}
  
  Business description:
  ${status.description_input}
  
  Return ONLY valid JSON using this exact shape:
  
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
    "buyer_intelligence": {
      "decision_factors": [],
      "common_objections": [],
      "trust_markers": [],
      "red_flags_customers_avoid": []
    },
    "preflight_strategy": {
      "summary": "",
      "primary_conversion": "",
      "secondary_conversion": "",
      "recommended_sections": [],
      "faq_angles": [],
      "aeo_angles": [],
      "sales_preview": "",
      "paid_phase_requirements": {
        "must_verify_now": [],
        "must_collect_paid_phase": [],
        "nice_to_have_assets": []
      }
    }
  }
  
  Rules:
  - Do not mention Google Business Profile.
  - Infer likely local-business strategy from the business name, location, and description only.
  - Keep outputs practical for a single-page local business website.
  - "business_model" should be one of: "service_area", "storefront", "hybrid", "destination", "online"
  - "vertical_complexity" should be one of: "low", "medium", "high"
  - "one_page_fit" should be one of: "excellent_fit", "conditional_fit", "complex_fit"
  - "confidence" should be a number between 0 and 1.
  - Return JSON only. No markdown.
  `;
  
      // 3) Call OpenAI directly for this dedicated recon shape
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
  
      // 4) Persist to Apps Script
      const appsScriptPayload = {
        route: "preflight_recon",
        factory_key: env.FACTORY_KEY,
        slug,
        entity_profile: parsed.entity_profile || {},
        buyer_intelligence: parsed.buyer_intelligence || {},
        preflight_strategy: parsed.preflight_strategy || {}
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