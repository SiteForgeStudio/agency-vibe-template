/**
 * Factory synthesis — vibe + image search signals derived from strategy contract + intake answers.
 * No industry-specific branching: uses opaque strategy fields, themes, tone, and lexical style cues only.
 */

export const SCHEMA_VIBES = [
  "Midnight Tech",
  "Zenith Earth",
  "Vintage Boutique",
  "Rugged Industrial",
  "Modern Minimal",
  "Luxury Noir",
  "Legacy Professional",
  "Solar Flare"
];

const STOPWORDS = new Set([
  "a", "an", "the", "and", "or", "for", "with", "from", "that", "this", "your", "our", "are", "was",
  "were", "been", "being", "have", "has", "had", "do", "does", "did", "will", "would", "could",
  "should", "may", "might", "must", "shall", "can", "need", "their", "they", "them", "its", "it",
  "we", "you", "i", "he", "she", "his", "her", "who", "whom", "which", "what", "when", "where",
  "why", "how", "all", "each", "every", "both", "few", "more", "most", "other", "some", "such",
  "no", "nor", "not", "only", "own", "same", "so", "than", "too", "very", "just", "also", "into",
  "about", "after", "before", "between", "through", "during", "under", "over", "again", "then",
  "here", "there", "any", "out", "off", "up", "down", "per", "via", "based", "local", "best",
  "top", "full", "new", "get", "help", "make", "work", "services", "service", "business", "company"
]);

/** Style cues map to schema vibes (order: first match wins). */
const VIBE_STYLE_RULES = [
  { re: /\b(luxury|noir|upscale|opulent|black\s*tie|high\s*end)\b/i, vibe: "Luxury Noir" },
  { re: /\b(zen|calm|earth|organic|natural|grounded|serene)\b/i, vibe: "Zenith Earth" },
  { re: /\b(heritage|legacy|timeless|classic|established|institutional)\b/i, vibe: "Legacy Professional" },
  { re: /\b(industrial|rugged|forge|steel|workshop|grit)\b/i, vibe: "Rugged Industrial" },
  { re: /\b(solar|flare|warm\s*gold|sunlit|radiant|energetic)\b/i, vibe: "Solar Flare" },
  { re: /\b(tech|cyber|neon|midnight|digital|futur)\b/i, vibe: "Midnight Tech" },
  { re: /\b(vintage|boutique|curated|artisan|craft)\b/i, vibe: "Vintage Boutique" },
  { re: /\b(minimal|clean|simple|quiet|refined|airy)\b/i, vibe: "Modern Minimal" }
];

function cleanString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function cleanList(value) {
  if (!Array.isArray(value)) return [];
  return value.map(cleanString).filter(Boolean);
}

function clampWords(text, min, max) {
  const words = String(text || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (words.length <= max && words.length >= min) return words.join(" ");
  if (words.length > max) return words.slice(0, max).join(" ");
  const pad = ["photography", "professional", "quality", "detail", "natural", "light"];
  const out = words.slice();
  let i = 0;
  while (out.length < min && i < pad.length) {
    out.push(pad[i++]);
  }
  return out.slice(0, max).join(" ");
}

export function stableHash(input) {
  const str = String(input || "");
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

/**
 * Combined lowercase text used for style scoring and keyword extraction (no single "industry" switch).
 */
export function buildStyleSignalBlob(strategyContract, state) {
  const a = state?.answers || {};
  const parts = [
    cleanString(strategyContract?.visual_strategy?.recommended_vibe),
    cleanString(strategyContract?.business_context?.strategic_archetype),
    cleanString(strategyContract?.business_context?.one_page_fit),
    cleanString(a.tone_of_voice),
    cleanString(a.differentiation),
    cleanString(a.website_direction),
    cleanString(a.primary_offer),
    cleanList(strategyContract?.asset_policy?.preferred_image_themes).join(" "),
    cleanList(strategyContract?.visual_strategy?.preferred_image_themes).join(" ")
  ];
  return parts.filter(Boolean).join(" ").toLowerCase();
}

function extractVisualKeywords(blob, maxWords = 8) {
  const raw = String(blob || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ");
  const tokens = raw
    .split(/\s+/)
    .map((w) => w.trim())
    .filter((w) => w.length > 2 && !STOPWORDS.has(w));

  const seen = new Set();
  const out = [];
  for (const t of tokens) {
    if (seen.has(t)) continue;
    seen.add(t);
    out.push(t);
    if (out.length >= maxWords) break;
  }
  return out;
}

function scoreVibeFromBlob(blob) {
  if (!blob) return null;
  for (const rule of VIBE_STYLE_RULES) {
    if (rule.re.test(blob)) return rule.vibe;
  }
  return null;
}

/**
 * Resolve settings.vibe: trust contract enum when valid, else style text, else stable hash on opaque archetype.
 */
export function selectVibe(allowedVibes, strategyContract, state) {
  const allowed = Array.isArray(allowedVibes) ? allowedVibes : SCHEMA_VIBES;
  const raw = cleanString(strategyContract?.visual_strategy?.recommended_vibe);
  if (allowed.includes(raw)) return raw;

  const blob = buildStyleSignalBlob(strategyContract, state);
  const scored = scoreVibeFromBlob(blob);
  if (scored && allowed.includes(scored)) return scored;

  const arch = cleanString(strategyContract?.business_context?.strategic_archetype);
  const idx = stableHash(`${arch}|${blob}`) % allowed.length;
  return allowed[idx];
}

function isObject(value) {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function uniqueStableStrings(items) {
  const seen = new Set();
  const out = [];
  for (const s of items) {
    const t = cleanString(s);
    if (!t) continue;
    const k = t.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(t);
  }
  return out;
}

function rotateStable(arr, hash) {
  if (!Array.isArray(arr) || !arr.length) return arr;
  const off = Math.abs(hash) % arr.length;
  return [...arr.slice(off), ...arr.slice(0, off)];
}

/** Experience signals only — no category names; archetype is opaque strategy slug. */
function buildVisualSignalBlob(state, strategyContract) {
  const pi = isObject(state?.preflight_intelligence) ? state.preflight_intelligence : {};
  const em = isObject(pi.experience_model) ? pi.experience_model : {};
  const focus = uniqueStableStrings([
    ...cleanList(state?.answers?.recommended_focus),
    ...cleanList(pi.recommended_focus)
  ]);
  return {
    experience_model: em,
    archetype: cleanString(strategyContract?.business_context?.strategic_archetype),
    recommended_focus: focus
  };
}

function buildStrategyModelsForVisuals(signalBlob) {
  const exp = isObject(signalBlob?.experience_model) ? signalBlob.experience_model : {};
  const dm = cleanString(exp.decision_mode).toLowerCase();
  const consultative =
    dm === "guided" ||
    dm.includes("guided") ||
    dm.includes("education") ||
    dm === "appointment_required" ||
    dm === "multi_visit_decision";
  return {
    process_strategy: {
      type: consultative ? "consultative" : "simple"
    }
  };
}

function deriveVisualPatterns(signalBlob, strategyModels) {
  const patterns = [];

  const exp = signalBlob.experience_model || {};
  const archetype = cleanString(signalBlob.archetype || "");

  if (
    cleanString(exp.visual_importance).toLowerCase() === "critical" ||
    archetype.toLowerCase().includes("visual")
  ) {
    patterns.push("transformation");
  }

  if (
    cleanString(exp.decision_mode).toLowerCase().includes("guided") ||
    strategyModels?.process_strategy?.type === "consultative"
  ) {
    patterns.push("process");
  }

  if (cleanString(exp.trust_requirement).toLowerCase() === "high_technical") {
    patterns.push("detail");
  }

  if (!patterns.length) {
    patterns.push("environment", "people");
  }

  return patterns;
}

/**
 * Scene language from abstract patterns — not a static flat list; keyed by pattern role.
 */
function buildQueriesFromPatterns(patterns) {
  const map = {
    transformation: [
      "before and after result comparison in clear even light",
      "final outcome showcase with calm confident atmosphere"
    ],
    process: [
      "professional at work in tidy unbranded real context",
      "behind the scenes workflow in organized calm workspace"
    ],
    detail: [
      "close-up detail precision with textured material clarity",
      "macro texture quality under soft natural side light"
    ],
    environment: [
      "authentic real world setting with warm ambient depth",
      "quiet interior environment scene with natural window light"
    ],
    people: [
      "candid customer interaction moment in approachable natural light",
      "calm human service moment with quiet trustworthy warmth"
    ]
  };

  return uniqueStableStrings(patterns.flatMap((p) => map[p] || []));
}

/**
 * Hero image search query: experience patterns + stable rotation (no category or trade terms).
 * `resolvedVibe` participates only in the hash for stable variety, not as a label in the query text.
 */
export function buildHeroImageQuery(state, strategyContract, resolvedVibe) {
  const signalBlob = buildVisualSignalBlob(state, strategyContract);
  const strategyModels = buildStrategyModelsForVisuals(signalBlob);
  const patterns = deriveVisualPatterns(signalBlob, strategyModels);
  let queries = buildQueriesFromPatterns(patterns);
  const slug = cleanString(state?.slug) || "site";
  const h = stableHash(`${slug}|${patterns.join("|")}|${cleanString(resolvedVibe)}|hero`);
  queries = rotateStable(queries, h);
  const joined = queries.slice(0, 3).join(", ");
  return (
    cleanString(joined) ||
    clampWords("authentic real world setting with natural window light and calm depth", 6, 14)
  );
}

/**
 * Gallery fallback queries: same pattern engine; per-client stable order; strings sized for downstream clamp.
 */
export function buildFallbackGalleryQueries(state, strategyContract, resolvedVibe) {
  const signalBlob = buildVisualSignalBlob(state, strategyContract);
  const strategyModels = buildStrategyModelsForVisuals(signalBlob);
  const patterns = deriveVisualPatterns(signalBlob, strategyModels);
  let queries = buildQueriesFromPatterns(patterns);
  const slug = cleanString(state?.slug) || "site";
  const arch = cleanString(strategyContract?.business_context?.strategic_archetype);
  const h = stableHash(`${slug}|${arch}|${patterns.join("|")}|${cleanString(resolvedVibe)}|gallery`);
  queries = rotateStable(queries, h);
  const sliced = queries.slice(0, 5);
  return sliced.map((q) => clampWords(q, 4, 8));
}

export function beforeAfterImageQuery(state, strategyContract, resolvedVibe) {
  const a = state?.answers || {};
  const mini = [
    cleanString(a.primary_offer),
    cleanString(strategyContract?.business_context?.category),
    cleanString(resolvedVibe)
  ]
    .filter(Boolean)
    .join(" ");
  const k = extractVisualKeywords(mini, 4).join(" ");
  const base = k || "professional service";
  return clampWords(`${base} before after transformation detail`, 4, 8);
}

export function inferPremiumGalleryCount(strategyContract, state, vibe) {
  const themes = [
    ...cleanList(strategyContract?.asset_policy?.preferred_image_themes),
    ...cleanList(strategyContract?.visual_strategy?.preferred_image_themes)
  ];
  const arch = cleanString(strategyContract?.business_context?.strategic_archetype);
  const photoHint =
    cleanString(state?.answers?.photos_status).toLowerCase().includes("have") ||
    cleanList(state?.answers?.gallery_queries).length > 0;

  const vi = cleanString(state?.preflight_intelligence?.experience_model?.visual_importance).toLowerCase();
  const visualBump = vi === "critical" ? 2 : vi === "high" ? 1 : 0;

  const base = 5 + (stableHash(`${arch}|${vibe}|${themes.length}`) % 5);
  const bump = photoHint ? 1 : 0;
  return Math.min(9, base + bump + visualBump);
}

/**
 * Layout from strategy-only signals (theme richness + stable archetype), not business category labels.
 */
export function galleryLayoutFromSignals(strategyContract) {
  const themes = [
    ...cleanList(strategyContract?.asset_policy?.preferred_image_themes),
    ...cleanList(strategyContract?.visual_strategy?.preferred_image_themes)
  ];
  if (themes.length >= 4) return "masonry";
  if (themes.length >= 2) return "bento";
  const arch = cleanString(strategyContract?.business_context?.strategic_archetype);
  return ["grid", "masonry", "bento"][stableHash(arch) % 3];
}

export function assertFactorySynthesisGuards(data) {
  const vibe = cleanString(data?.settings?.vibe);
  if (!vibe) throw new Error("Factory synthesis failed: missing vibe");
  if (!SCHEMA_VIBES.includes(vibe)) throw new Error("Factory synthesis failed: invalid vibe");
  const heroQ = cleanString(data?.hero?.image?.image_search_query);
  if (!heroQ) throw new Error("Factory synthesis failed: missing hero image query");
}
