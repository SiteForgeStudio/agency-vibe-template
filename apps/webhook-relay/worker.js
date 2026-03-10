export default {
    async fetch(request, env, ctx) {
      if (request.method !== "POST") {
        return json({ ok: false, error: "Method Not Allowed" }, 405);
      }
  
      try {
        const rawBody = await request.text();
  
        // Optional GitHub signature verification
        if (env.GITHUB_WEBHOOK_SECRET) {
          const sig = request.headers.get("X-Hub-Signature-256");
          const valid = await verifyGitHubSignature(rawBody, sig, env.GITHUB_WEBHOOK_SECRET);
          if (!valid) {
            return json({ ok: false, error: "Invalid GitHub signature" }, 401);
          }
        }
  
        // Optional event restriction
        const event = request.headers.get("X-GitHub-Event") || "";
        if (event && event !== "workflow_run") {
          return json({ ok: true, ignored: `Ignoring event ${event}` }, 200);
        }
  
        const upstream = await fetch(env.APPS_SCRIPT_WEBHOOK_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: rawBody
        });
  
        const text = await upstream.text();
  
        let parsed;
        try {
          parsed = JSON.parse(text);
        } catch {
          parsed = { ok: upstream.ok, raw: text };
        }
  
        return new Response(JSON.stringify({
          ok: upstream.ok,
          relayed: true,
          upstream_status: upstream.status,
          upstream_body: parsed
        }), {
          status: upstream.ok ? 200 : 502,
          headers: { "Content-Type": "application/json" }
        });
  
      } catch (err) {
        return json({ ok: false, error: String(err?.message || err) }, 500);
      }
    }
  };
  
  function json(obj, status = 200) {
    return new Response(JSON.stringify(obj), {
      status,
      headers: { "Content-Type": "application/json" }
    });
  }
  
  async function verifyGitHubSignature(rawBody, signatureHeader, secret) {
    if (!signatureHeader || !signatureHeader.startsWith("sha256=")) return false;
  
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );
  
    const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(rawBody));
    const hex = [...new Uint8Array(sig)]
      .map(b => b.toString(16).padStart(2, "0"))
      .join("");
  
    const expected = `sha256=${hex}`;
    return timingSafeEqual(expected, signatureHeader);
  }
  
  function timingSafeEqual(a, b) {
    if (a.length !== b.length) return false;
    let out = 0;
    for (let i = 0; i < a.length; i++) {
      out |= a.charCodeAt(i) ^ b.charCodeAt(i);
    }
    return out === 0;
  }