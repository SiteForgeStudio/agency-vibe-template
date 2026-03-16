// apps/intake/functions/api/preflight-preview.js

function json(data, status = 200) {
    return new Response(JSON.stringify(data, null, 2), {
      status,
      headers: {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "no-store"
      }
    });
  }
  
  export async function onRequest(context) {
    const { request, env } = context;
  
    if (request.method !== "GET") {
      return json({ ok: false, error: "Use GET /api/preflight-preview?slug=..." }, 405);
    }
  
    try {
      const url = new URL(request.url);
      const slug = url.searchParams.get("slug");
  
      if (!slug) {
        return json({ ok: false, error: "Missing slug" }, 400);
      }
  
      const scriptUrl = env.APPS_SCRIPT_WEBAPP_URL;
      const factoryKey = env.FACTORY_KEY;
  
      const payload = {
        route: "preflight_preview",
        factory_key: factoryKey,
        slug
      };
  
      const res = await fetch(scriptUrl, {
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
      return json({ ok: false, error: String(err?.message || err) }, 500);
    }
  }