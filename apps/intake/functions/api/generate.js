import generate from "../../netlify/functions/generate.mjs";

export async function onRequestPost(context) {
  // Provide env to your existing function
  globalThis.OPENAI_API_KEY = context.env.OPENAI_API_KEY;

  const req = {
    async json() {
      return await context.request.json();
    }
  };

  const res = await generate(req);
  return res instanceof Response
    ? res
    : new Response(JSON.stringify(res), { headers: { "content-type": "application/json" } });
}

export async function onRequestGet() {
  return new Response(JSON.stringify({ ok: false, error: "Use POST /api/generate" }), {
    status: 405,
    headers: { "content-type": "application/json" }
  });
}