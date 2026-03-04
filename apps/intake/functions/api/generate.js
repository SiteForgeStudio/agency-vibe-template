import { SYSTEM_RULES, VIBE_GUIDE, ICON_LIST } from "./prompts.js";

/**
 * Cloudflare Pages Function
 * POST /api/generate
 *
 * Expected body:
 * {
 *   businessName: string,
 *   story: string,
 *   clientEmail?: string
 * }
 */
export async function onRequestPost({ request, env }) {
  try {
    const body = await request.json();
    const businessName = String(body.businessName || "").trim();
    const story = String(body.story || "").trim();

    if (!businessName || !story) {
      return json({ ok: false, error: "Missing businessName or story" }, 400);
    }

    // 1) Call your AI provider (you must wire this)
    // Recommended: keep this as a single function so swapping providers is easy.
    const aiResponse = await callAI_({ businessName, story }, env);

    // 2) Hydrate / normalize
    const clientSlug = normalizeSlug_(aiResponse?.brand?.slug || businessName);
    const hydrated = hydrateProjectData_(aiResponse, clientSlug);

    // 3) OPTIONAL: Commit base.json here (if you still want that in Cloudflare)
    // If you prefer: do NOT commit here; let Apps Script be the only writer to GitHub.
    if (env.GITHUB_TOKEN && env.GITHUB_OWNER && env.GITHUB_REPO) {
      await githubPutFile_(
        env,
        `clients/${clientSlug}/business.base.json`,
        JSON.stringify(hydrated, null, 2),
        `Factory: commit base for ${clientSlug}`,
        true
      );
    }

    return json({ ok: true, client_slug: clientSlug, business_json: hydrated });
  } catch (err) {
    return json({ ok: false, error: String(err?.message || err) }, 500);
  }
}

/* -----------------------------
   AI CALL (PLUG YOUR PROVIDER)
------------------------------ */
async function callAI_({ businessName, story }, env) {
  if (!env.OPENAI_API_KEY) throw new Error("Missing env.OPENAI_API_KEY");

  const system = [
    SYSTEM_RULES,
    VIBE_GUIDE,
    `ICON LIST (choose only from these for icon fields): ${ICON_LIST}`,
    `OUTPUT RULES:
- Return ONLY valid JSON (no markdown, no commentary).
- Must include: brand, intelligence, strategy, settings, hero, about, trustbar, gallery, contact (at minimum).
- All menu links must be # anchors.
- Every image object must include image_search_query (5-8 words).`
  ].join("\n\n");

  const user = `Business Name: ${businessName}\n\nStory:\n${story}`;

  const res = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: env.OPENAI_MODEL || "gpt-4.1-mini",
      input: [
        { role: "system", content: system },
        { role: "user", content: user }
      ],
      // ✅ JSON-only output for Responses API
      text: {
        format: { type: "json_object" }
      }
    }),
  });

  if (!res.ok) {
    const t = await res.text();
    throw new Error(`OpenAI error (${res.status}): ${t}`);
  }

  const data = await res.json();

  // Responses API commonly returns text in output[0].content[0].text
  const text =
    data?.output?.[0]?.content?.find(c => c.type === "output_text")?.text
    ?? data?.output_text
    ?? null;

  if (!text) throw new Error("OpenAI returned no text output");

  let json;
  try { json = JSON.parse(text); }
  catch { throw new Error("OpenAI did not return valid JSON"); }

  return json;
}

/* -----------------------------
   HYDRATION (YOUR LOGIC, SAFE)
------------------------------ */
function hydrateProjectData_(raw, slug) {
  const data = JSON.parse(JSON.stringify(raw || {}));

  data.brand = data.brand || {};
  data.brand.slug = normalizeSlug_(data.brand.slug || slug);

  data.settings = data.settings || {};
  if (!Array.isArray(data.settings.menu) || data.settings.menu.length === 0) {
    data.settings.menu = [
      { label: "Home", path: "#home" },
      { label: "About", path: "#about" },
      { label: "Gallery", path: "#gallery" },
      { label: "Contact", path: "#contact" },
    ];
  }
  data.settings.cta_text = data.settings.cta_text || "Get Started";
  data.settings.cta_link = data.settings.cta_link || "#contact";

  const industry = String(data.intelligence?.industry || "").toLowerCase();
  const isLuxury = industry.includes("watch") || industry.includes("luxury") || industry.includes("jewelry");
  const isEvent = Boolean(data.strategy?.show_events) || industry.includes("entertainment") || industry.includes("theatre");

  if (data.strategy?.show_gallery) {
    data.gallery = data.gallery || { enabled: true };
    if (!data.gallery.computed_layout) {
      data.gallery.computed_layout = isLuxury ? "bento" : isEvent ? "masonry" : "grid";
    }
    const count = data.gallery.computed_count || 6;
    if (!Array.isArray(data.gallery.items) || data.gallery.items.length === 0) {
      data.gallery.items = Array.from({ length: count }).map((_, i) => ({ title: `Project ${i + 1}` }));
    }
  }

  if (data.strategy?.show_about) {
    data.about = data.about || {};
    if (!data.about.story_text || String(data.about.story_text).length < 20) {
      data.about.story_text = isLuxury
        ? `${data.brand.name || "This brand"} preserves the heritage of fine craftsmanship with modern precision.`
        : `${data.brand.name || "This brand"} delivers excellence through passion and expertise.`;
    }
    data.about.founder_note = data.about.founder_note || "Precision in every detail.";
    data.about.years_experience = data.about.years_experience || "15+";
  }

  return data;
}

function normalizeSlug_(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/'/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/* -----------------------------
   GITHUB PUT FILE via REST API
------------------------------ */
async function githubPutFile_(env, repoPath, contentString, message, overwrite = true) {
  const owner = env.GITHUB_OWNER;
  const repo = env.GITHUB_REPO;
  const token = env.GITHUB_TOKEN;

  if (!owner || !repo || !token) return;

  const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${repoPath}`;

  // Get SHA if exists
  let sha = undefined;
  const existing = await fetch(apiUrl, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json" },
  });

  if (existing.status === 200) {
    if (!overwrite) return;
    const json = await existing.json();
    sha = json.sha;
  }

  const payload = {
    message,
    content: base64_(contentString),
    ...(sha ? { sha } : {}),
  };

  const res = await fetch(apiUrl, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const t = await res.text();
    throw new Error(`GitHub PUT failed (${res.status}): ${t}`);
  }
}

function base64_(str) {
  // Cloudflare-safe base64 (no Buffer)
  const bytes = new TextEncoder().encode(str);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}