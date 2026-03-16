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
      You are the SiteForge Factory Pre-Flight Recon Engine.
      
      Your job:
      Create a first-pass strategic assessment for a local business before the paid build intake begins.
      
      This output has TWO purposes:
      1. internal strategic intelligence for SiteForge
      2. a selective client-facing preview that inspires the client to move forward
      
      Important:
      - Do NOT give away the full strategy in the client-facing preview.
      - The client-facing preview should be persuasive, specific, and valuable, but incomplete.
      - Keep the strongest implementation details in internal_strategy.
      - Infer from the business name, location, and description only.
      - Do not mention Google Business Profile yet.
      - Focus on what makes this business a fit or non-fit for a high-performing single-page local business website.
      - Prefer practical local-business strategy over generic branding language.
      
      Business name:
      ${status.input_business_name}
      
      Location / service area:
      ${status.city_or_service_area_input}
      
      Business description:
      ${status.description_input}
      
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
      - no generic agency clichés

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

      Return JSON only. No markdown. No commentary.
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
        internal_strategy: parsed.internal_strategy || {},
        client_preview: parsed.client_preview || {}
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