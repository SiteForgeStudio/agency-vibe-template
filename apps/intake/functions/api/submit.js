import submit from "../../netlify/functions/submit.mjs";

export async function onRequestPost(context) {
  // Provide env to your existing function
  globalThis.APPS_SCRIPT_WEBAPP_URL = context.env.APPS_SCRIPT_WEBAPP_URL;
  globalThis.FACTORY_KEY = context.env.FACTORY_KEY;

  const req = {
    async json() {
      return await context.request.json();
    }
  };

  const res = await submit(req);
  return res instanceof Response
    ? res
    : new Response(JSON.stringify(res), { headers: { "content-type": "application/json" } });
}

export async function onRequestGet() {
  return new Response(JSON.stringify({ ok: false, error: "Use POST /api/submit" }), {
    status: 405,
    headers: { "content-type": "application/json" }
  });
}
