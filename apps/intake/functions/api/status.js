export async function onRequestGet({ request, env }) {
    try {
      const url = new URL(request.url);
      const slug = (url.searchParams.get("slug") || "").trim();
  
      if (!slug) {
        return json({ ok: false, error: "Missing slug" }, 400);
      }
  
      const base = env.APPS_SCRIPT_STATUS_URL;
      if (!base) {
        throw new Error("Missing APPS_SCRIPT_STATUS_URL env var");
      }
  
      const upstreamUrl = `${base}?slug=${encodeURIComponent(slug)}`;
      const res = await fetch(upstreamUrl, {
        method: "GET",
        headers: { "Accept": "application/json" }
      });
  
      const text = await res.text();
  
      let parsed;
      try {
        parsed = JSON.parse(text);
      } catch {
        throw new Error(`Status upstream returned non-JSON: ${text}`);
      }
  
      return new Response(JSON.stringify(parsed), {
        status: res.ok ? 200 : res.status,
        headers: { "content-type": "application/json; charset=utf-8" }
      });
    } catch (err) {
      return json({ ok: false, error: String(err?.message || err) }, 500);
    }
  }
  
  function json(obj, status = 200) {
    return new Response(JSON.stringify(obj), {
      status,
      headers: { "content-type": "application/json; charset=utf-8" }
    });
  }