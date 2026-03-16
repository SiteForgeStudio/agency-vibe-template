export async function onRequest(context) {
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