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

/**
 * Intent: abstract “what kind of visual story” from intake `signalBlob` + `strategyModels` — not category routing.
 * Output is pattern ids consumed only by `buildQueriesFromPatterns`.
 */
function deriveVisualPatterns(signalBlob, strategyModels) {
  const patterns = [];

  const exp = isObject(signalBlob?.experience_model) ? signalBlob.experience_model : {};
  const archetype = cleanString(signalBlob?.archetype || "");
  const processType = cleanString(strategyModels?.process_strategy?.type || "");

  if (
    cleanString(exp.visual_importance).toLowerCase() === "critical" ||
    archetype.toLowerCase().includes("visual")
  ) {
    patterns.push("transformation");
  }

  if (cleanString(exp.decision_mode).toLowerCase().includes("guided") || processType === "consultative") {
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
 * Query: scene phrases from intent patterns — role-keyed map, not per-industry strings.
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

function detectVisualModeFromSignals(visual) {
  const focus = Array.isArray(visual?.recommended_focus) ? visual.recommended_focus : [];
  const mustShow = Array.isArray(visual?.must_show) ? visual.must_show : [];
  const themes = Array.isArray(visual?.image_themes) ? visual.image_themes : [];

  const combined = [...focus, ...mustShow, ...themes].map((s) => String(s).toLowerCase());

  if (combined.length >= 2) {
    return "process";
  }

  if (themes.length > 0 && focus.length === 0) {
    return "interaction";
  }

  if (focus.length > 0 && mustShow.length === 0) {
    return "result";
  }

  return "general";
}

/**
 * Rich text for keyword extraction — business nouns beat generic "service process" templates.
 */
function buildHeroKeywordSourceBlob(signalBlob, visual) {
  const focus = Array.isArray(visual?.recommended_focus) ? visual.recommended_focus : [];
  const mustShow = Array.isArray(visual?.must_show) ? visual.must_show : [];
  const themes = Array.isArray(visual?.image_themes) ? visual.image_themes : [];

  return [
    ...focus,
    ...mustShow,
    ...themes,
    cleanString(visual?.visual_story),
    cleanString(visual?.differentiation),
    cleanString(visual?.gallery_story),
    cleanString(signalBlob?.offer),
    cleanString(signalBlob?.positioning),
    cleanString(signalBlob?.opportunity),
    cleanString(signalBlob?.angle),
    cleanString(signalBlob?.category),
    cleanString(signalBlob?.archetype),
    cleanString(signalBlob?.persona)
  ]
    .filter(Boolean)
    .join(" ");
}

/**
 * Hero image search query: prefer **lexical tokens from real business copy** (offer, focus, PI visual)
 * before falling back to mode/category templates. Stock search works best with concrete subjects
 * (e.g. framing, gallery, mat) — not the word "service" repeated.
 */
export function buildHeroImageQuery(signalBlob, strategyModels, state, resolvedVibe) {
  const visual = signalBlob?.visual || {};

  const focus = Array.isArray(visual.recommended_focus) ? visual.recommended_focus : [];
  const mustShow = Array.isArray(visual.must_show) ? visual.must_show : [];
  const themes = Array.isArray(visual.image_themes) ? visual.image_themes : [];

  const story = visual.visual_story || "";
  const differentiation = visual.differentiation || "";
  const galleryStory = visual.gallery_story || "";

  const signalPartsLower = [
    ...focus,
    ...mustShow,
    ...themes,
    story,
    differentiation,
    galleryStory,
    cleanString(signalBlob?.offer),
    cleanString(signalBlob?.positioning)
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  const blobForKeywords = buildHeroKeywordSourceBlob(signalBlob, visual);
  let keywords = extractVisualKeywords(blobForKeywords, 14);

  if (keywords.length < 4 && cleanString(signalBlob?.offer)) {
    keywords = uniqueStableStrings([
      ...keywords,
      ...extractVisualKeywords(cleanString(signalBlob.offer), 10)
    ]).slice(0, 12);
  }

  const vibeHint = resolvedVibe ? String(resolvedVibe).toLowerCase() : "";
  let style = "natural window light";
  if (vibeHint.includes("minimal")) {
    style = "clean minimal natural light";
  } else if (vibeHint.includes("luxury")) {
    style = "soft refined light";
  } else if (vibeHint.includes("industrial")) {
    style = "workshop natural light";
  }

  if (keywords.length >= 3) {
    const core = keywords.slice(0, 10).join(" ");
    const detailHints = [];
    if (signalPartsLower.includes("frame") || signalPartsLower.includes("mat") || signalPartsLower.includes("matting")) {
      detailHints.push("picture frame mat corner detail");
    }
    if (signalPartsLower.includes("gallery") || signalPartsLower.includes("showroom")) {
      detailHints.push("gallery wall");
    }
    if (signalPartsLower.includes("artist") || signalPartsLower.includes("studio")) {
      detailHints.push("artist studio");
    }
    const tail = detailHints.length ? ` ${detailHints[0]}` : "";
    return clampWords(`${core}${tail} ${style}`, 8, 22).trim();
  }

  const category = cleanString(signalBlob?.category) || "business";
  const mode = detectVisualModeFromSignals(visual);

  let subject = "";
  if (mode === "process") {
    subject = `${category} professional workspace craftsmanship`;
  } else if (mode === "interaction") {
    subject = `${category} customer consultation`;
  } else if (mode === "result") {
    subject = `${category} finished work on display`;
  } else {
    subject = `${category} professional interior`;
  }

  const detailHints = [];
  if (signalPartsLower.includes("craft") || signalPartsLower.includes("quality")) {
    detailHints.push("detail");
  }
  if (signalPartsLower.includes("custom") || signalPartsLower.includes("personal")) {
    detailHints.push("custom work");
  }
  if (signalPartsLower.includes("artist") || signalPartsLower.includes("creative")) {
    detailHints.push("creative workspace");
  }

  let query = [subject, ...detailHints, style]
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();

  if (!query || query.length < 10) {
    query = `${category} professional realistic natural light`;
  }

  return clampWords(query, 6, 18).trim();
}

/**
 * Gallery fallback queries: same patterns + rotation as hero; strings sized for downstream clamp.
 */
export function buildFallbackGalleryQueries(signalBlob, strategyModels, state, resolvedVibe) {
  const patterns = deriveVisualPatterns(signalBlob, strategyModels);
  let queries = buildQueriesFromPatterns(patterns);
  const slug = cleanString(state?.slug) || "site";
  const arch = cleanString(signalBlob?.archetype);
  const h = stableHash(`${slug}|${arch}|${patterns.join("|")}|${cleanString(resolvedVibe)}|gallery`);
  queries = rotateStable(queries, h);
  const sliced = queries.slice(0, 5);
  const visual = signalBlob?.visual || {};
  const prefixBlob = [
    ...cleanList(visual.recommended_focus),
    cleanString(signalBlob?.offer),
    cleanString(signalBlob?.category),
    cleanString(signalBlob?.positioning)
  ]
    .filter(Boolean)
    .join(" ");
  const prefixKw = extractVisualKeywords(prefixBlob, 6).slice(0, 4).join(" ");
  return sliced.map((q) => {
    if (!prefixKw) return clampWords(q, 4, 8);
    return clampWords(`${prefixKw} ${q}`, 6, 14);
  });
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
