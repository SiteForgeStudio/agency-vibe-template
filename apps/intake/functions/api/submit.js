export async function onRequest(context) {
  const { request, env } = context;

  if (request.method !== "POST") {
    return new Response(JSON.stringify({ ok: false, error: "Use POST /api/submit" }), {
      status: 405,
      headers: { "content-type": "application/json" },
    });
  }

  try {
    const body = await request.json();

    const url = env.APPS_SCRIPT_WEBAPP_URL;
    const factoryKey = env.FACTORY_KEY;

    if (!url) throw new Error("Missing APPS_SCRIPT_WEBAPP_URL env var");
    if (!factoryKey) throw new Error("Missing FACTORY_KEY env var");

    const payload = {
      factory_key: factoryKey,
      business_json: body.business_json,
      client_email: body.client_email || body.business_json?.brand?.email || ""
    };

    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload)
    });

    const text = await res.text();
    if (!res.ok) throw new Error(`Apps Script error ${res.status}: ${text}`);

    return new Response(text, { headers: { "content-type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ ok: false, error: String(err?.message || err) }), {
      status: 500,
      headers: { "content-type": "application/json" }
    });
  }
}
