export async function onRequest(context) {
    const { request, env } = context;
  
    if (request.method !== "POST") {
      return new Response(
        JSON.stringify({ ok: false, error: "POST required" }),
        { status: 405, headers: { "content-type": "application/json" } }
      );
    }
  
    try {
      const body = await request.json();
      const slug = String(body.slug || "").trim();
  
      if (!slug) {
        return new Response(
          JSON.stringify({ ok: false, error: "Missing slug" }),
          { status: 400, headers: { "content-type": "application/json" } }
        );
      }
  
      // ------------------------------------------------
      // 1. Load preflight record
      // ------------------------------------------------
  
      const statusRes = await fetch(
        new URL("/api/preflight-status", request.url),
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ slug })
        }
      );
  
      const status = await statusRes.json();
  
      if (!status.ok) {
        return new Response(
          JSON.stringify(status),
          { status: 404, headers: { "content-type": "application/json" } }
        );
      }
  
      // ------------------------------------------------
      // 2. Build AI prompt
      // ------------------------------------------------
  
      const prompt = `
  You are a business strategist.
  
  Business:
  ${status.input_business_name}
  
  Location:
  ${status.city_or_service_area_input}
  
  Description:
  ${status.description_input}
  
  Infer:
  
  1. Business category
  2. Business model (service-area, storefront, hybrid)
  3. Buyer decision factors
  4. Trust signals customers expect
  5. Primary conversion goal
  6. Recommended website sections
  
  Return JSON in this structure:
  
  {
    "entity_profile": {},
    "buyer_intelligence": {},
    "preflight_strategy": {}
  }
  `;
  
      // ------------------------------------------------
      // 3. Call existing AI endpoint
      // ------------------------------------------------
  
      const aiRes = await fetch(
        new URL("/api/generate", request.url),
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            mode: "preflight_recon",
            prompt
          })
        }
      );
  
      const aiJson = await aiRes.json();
      const parsed = aiJson.result || {};
  
      // ------------------------------------------------
      // 4. Send results to Apps Script
      // ------------------------------------------------
  
      const appsScriptPayload = {
        route: "preflight_recon",
        factory_key: env.FACTORY_KEY,
        slug: slug,
        entity_profile: parsed.entity_profile || {},
        buyer_intelligence: parsed.buyer_intelligence || {},
        preflight_strategy: parsed.preflight_strategy || {}
      };
  
      const res = await fetch(env.APPS_SCRIPT_WEBAPP_URL, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(appsScriptPayload)
      });
  
      const text = await res.text();
  
      return new Response(text, {
        status: res.status,
        headers: { "content-type": "application/json" }
      });
  
    } catch (err) {
      return new Response(
        JSON.stringify({ ok: false, error: String(err) }),
        { status: 500, headers: { "content-type": "application/json" } }
      );
    }
  }