// apps/intake/functions/api/preflight-preview.js
/**
 * Client-facing preflight preview — generated in the Worker using
 * preflight-status (including competitive_intelligence from recon) + LLM.
 * Apps Script is not the source of preview copy (avoids generic pass-through).
 */

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
  try {
    return JSON.parse(raw);
  } catch {}
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    throw new Error("AI did not return valid JSON");
  }
  return JSON.parse(raw.slice(start, end + 1));
}

/** Normalize fields that may be flat or nested depending on Apps Script shape */
function getRecordFields(status) {
  const website = String(
    status.optional_website_or_social ??
      status.client?.optional_website_or_social ??
      status.website_or_social ??
      ""
  ).trim();

  return {
    input_business_name: String(
      status.input_business_name ?? status.client?.input_business_name ?? ""
    ).trim(),
    city_or_service_area_input: String(
      status.city_or_service_area_input ??
        status.client?.city_or_service_area_input ??
        ""
    ).trim(),
    description_input: String(
      status.description_input ?? status.client?.description_input ?? ""
    ).trim(),
    website,
    competitive_intelligence: status.competitive_intelligence || {},
    client_preview: status.client_preview || {},
    entity_profile: status.entity_profile || {},
    gbp_audit: status.gbp_audit || {}
  };
}

function postProcessGoogleInsight(rawInsight, website, gbp) {
  const hasSite = /^https?:\/\//i.test(String(website || "").trim());
  const gs = String(gbp?.gbp_status ?? "").trim();
  if (hasSite && gs === "not_found") {
    return (
      "A website is on file for this business. This automated pass did not verify a live Google Business Profile in Maps—a listing may exist under a slightly different name or still need to be claimed and aligned with this domain."
    );
  }
  if (
    hasSite &&
    (gs === "unclear" || gs === "likely_exists") &&
    /does not appear to have a fully established Google Business presence/i.test(
      String(rawInsight || "")
    )
  ) {
    return (
      "You have a public web presence; a Google Business Profile may already exist or should be claimed so Maps and your site tell the same story for local discovery."
    );
  }
  return String(rawInsight || "").trim();
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

    if (!env.OPENAI_API_KEY) {
      return json({ ok: false, error: "Missing OPENAI_API_KEY env var" }, 500);
    }

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
        statusRes.status >= 400 ? statusRes.status : 404
      );
    }

    const f = getRecordFields(status);

    const prompt = `
You write the client-facing preflight PREVIEW for SiteForge (before paid intake). Return JSON only.

PRIMARY INPUT — competitive_intelligence from recon (must drive differentiation in every paragraph):
${JSON.stringify(f.competitive_intelligence, null, 2)}

Supporting context — entity_profile:
${JSON.stringify(f.entity_profile, null, 2)}

Prior recon client_preview (optional; refine, do not copy verbatim):
${JSON.stringify(f.client_preview, null, 2)}

gbp_audit (for google_presence_insight tone only):
${JSON.stringify(f.gbp_audit, null, 2)}

Business
- name: ${f.input_business_name}
- location: ${f.city_or_service_area_input}
- description: ${f.description_input}
- website: ${f.website || "(none)"}

ABSOLUTE RULES
1. Do NOT summarize the description in generic marketing language. ANALYZE: who loses if this business wins, what buyers compare, why someone would pick them vs a chain / online-only / commodity option — use competitive_intelligence fields explicitly when present; if empty, infer from name + category.
2. FORBIDDEN without concrete tie-in: "local gem", "passionate", "streamlined single-page", "visually engaging", "enhance visibility", "drive foot traffic", "unique offerings", "connect with you", "art enthusiasts" as empty fluff.
3. business_understanding: at most 2 sentences; must include at least one contrast vs a plausible alternative (e.g. big-box framing, online-only, mobile-only, commodity).
4. opportunity: 1–2 sentences; a specific strategic leverage (proof gap, trust gap, category confusion, craft vs price) — not "grow your business".
5. website_direction: 1 sentence; what the page must prove or make easy (no generic "showcase portfolio" alone).
6. recommended_focus: 3–5 strings; each specific to THIS business model and inputs (e.g. artist-owned craft, custom vs ready-made, gallery trust) — not generic "testimonials" unless paired with a reason.
7. google_presence_insight: short; reflect gbp_audit.gbp_status. Never claim we scraped Google Maps. If gbp_status is not_found but a website URL is listed above, say automated verification was not performed and next step is to check/claim GBP — do NOT say they have "no" web presence.
8. next_step: one sentence teaser for the paid phase.

Return ONLY this JSON shape:
{
  "business_understanding": "",
  "opportunity": "",
  "website_direction": "",
  "google_presence_insight": "",
  "recommended_focus": [],
  "next_step": ""
}
`.trim();

    const aiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.OPENAI_API_KEY}`,
        "content-type": "application/json"
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0.35,
        messages: [
          {
            role: "system",
            content:
              "You return only valid JSON. No markdown. No commentary. You are a sharp local-business strategist: differentiation and buyer tradeoffs, not agency boilerplate."
          },
          { role: "user", content: prompt }
        ]
      })
    });

    const aiJson = await aiRes.json();

    if (!aiRes.ok) {
      return json(
        {
          ok: false,
          error: aiJson?.error?.message || "OpenAI request failed",
          slug
        },
        502
      );
    }

    const content = aiJson?.choices?.[0]?.message?.content || "";
    let out;
    try {
      out = extractJsonObject(content);
    } catch (e) {
      return json(
        {
          ok: false,
          error: "Preview model did not return valid JSON",
          detail: String(e?.message || e),
          slug
        },
        502
      );
    }

    const body = {
      ok: true,
      slug,
      business_understanding: String(out.business_understanding || "").trim(),
      opportunity: String(out.opportunity || "").trim(),
      website_direction: String(out.website_direction || "").trim(),
      google_presence_insight: postProcessGoogleInsight(
        out.google_presence_insight,
        f.website,
        f.gbp_audit
      ),
      recommended_focus: Array.isArray(out.recommended_focus)
        ? out.recommended_focus.map((x) => String(x).trim()).filter(Boolean)
        : [],
      next_step: String(out.next_step || "").trim(),
      code: 200
    };

    return json(body, 200);
  } catch (err) {
    return json({ ok: false, error: String(err?.message || err) }, 500);
  }
}
