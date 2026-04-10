import fs from "fs";
import path from "path";

/**
 * Linear preflight pipeline runner (start → recon → gbp → preview).
 * Not a conversational loop — mirrors apps/intake/functions/api/preflight-*.js
 *
 * Usage:
 *   node scripts/preflight-runner/index.js
 *   node scripts/preflight-runner/index.js ./my-input.json
 *   PREFLIGHT_API_BASE=https://intake.getsiteforge.com/api node scripts/preflight-runner/index.js --status
 *
 * Env:
 *   PREFLIGHT_API_BASE — default https://intake.getsiteforge.com/api
 */

const API_BASE = (
  process.env.PREFLIGHT_API_BASE || "https://intake.getsiteforge.com/api"
).replace(/\/$/, "");

const DEFAULT_INPUT = {
  business_name: "Summit Ridge Window Cleaning",
  city_or_service_area: "Boulder, Colorado",
  description:
    "High-end residential window cleaning specializing in large homes, glass restoration, and streak-free results.",
  website_or_social: "",
  client_email: ""
};

let slug = null;
/** @type {Record<string, unknown>} */
const log = {
  meta: {
    api_base: API_BASE,
    started_at: new Date().toISOString(),
    qa_warnings: [],
    summary: null
  }
};

/** Non-empty string or meaningful object/array */
function present(value) {
  if (value == null) return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "object") return Object.keys(value).length > 0;
  return true;
}

function qaWarn(message) {
  log.meta.qa_warnings.push(message);
  console.warn(`⚠ ${message}`);
}

/** Heuristic 0–100: higher = less template-like marketing copy (not a substitute for human review). */
const POSITIONING_GENERIC = [
  /uniquely positioned/i,
  /local art enthusiasts/i,
  /enhancing visibility/i,
  /drive more foot traffic/i,
  /streamlined[, ]+visually engaging/i,
  /showcase(ing)? your (unique )?offerings/i,
  /connect with you/i,
  /fully established Google Business presence/i,
  /aligning that with your website/i,
  /emphasizing local community ties/i,
  /quality framing services/i
];

const OPPORTUNITY_GENERIC = [
  /enhancing visibility/i,
  /drive more foot traffic/i,
  /unique offerings/i,
  /showcase your/i,
  /grow your business/i,
  /online presence/i
];

/** Without any vs-alternatives framing, scores cannot read "strong" (heuristic). */
const COMPETITOR_COMPARISON_HINT =
  /(competitor|competitors|versus|vs\.|vs |big[\s-]?box|chain\b|online[- ]only|commodity framing|alternative(s)? to|compared to|differentiat|unlike (most|typical)|instead of (buying|using)|rather than (going|using)|who (often|typically)|national chain|warehouse|diy |do-it-yourself)/i;

function applyCompetitorCap(score, text) {
  if (COMPETITOR_COMPARISON_HINT.test(String(text || ""))) return score;
  return Math.min(score, 70);
}

function previewTextBlob(previewB) {
  return [
    previewB.business_understanding,
    previewB.opportunity,
    previewB.website_direction,
    ...(Array.isArray(previewB.recommended_focus) ? previewB.recommended_focus : [])
  ]
    .filter(Boolean)
    .join(" ");
}

function scoreFromGenericHits(text, patterns, input) {
  if (!String(text || "").trim()) return 0;
  let penalties = 0;
  for (const re of patterns) {
    if (re.test(text)) penalties++;
  }
  let score = 100 - Math.min(85, penalties * 14);
  const name = String(input?.business_name || "");
  const tokens = name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 3);
  const lower = text.toLowerCase();
  let nameHits = 0;
  for (const t of tokens) {
    if (t && lower.includes(t)) nameHits++;
  }
  if (nameHits >= 2) score = Math.min(100, score + 12);
  else if (nameHits === 1) score = Math.min(100, score + 6);
  return Math.max(0, Math.min(100, Math.round(score)));
}

function positioningSpecificityScore(previewB, input) {
  const blob = previewTextBlob(previewB);
  const raw = scoreFromGenericHits(blob, POSITIONING_GENERIC, input);
  return applyCompetitorCap(raw, blob);
}

function opportunityStrengthScore(previewB, input) {
  const text = [previewB.opportunity, previewB.business_understanding]
    .filter(Boolean)
    .join(" ");
  const raw = scoreFromGenericHits(text, OPPORTUNITY_GENERIC, input);
  return applyCompetitorCap(raw, text);
}

function strengthLabel(n) {
  if (n >= 67) return "strong";
  if (n >= 45) return "moderate";
  return "weak";
}

const logDir = path.resolve("scripts/preflight-runner/preflight-logs");
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

/**
 * @param {Response} res
 */
async function readJsonResponse(res) {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    return {
      ok: false,
      error: "Response was not valid JSON",
      _raw_preview: text.slice(0, 800)
    };
  }
}

function loadInput() {
  const argv = process.argv.slice(2);
  const withStatus = argv.includes("--status");
  const fileArg = argv.find((a) => !a.startsWith("-"));
  if (!fileArg) {
    return { input: { ...DEFAULT_INPUT }, withStatus };
  }
  const abs = path.isAbsolute(fileArg) ? fileArg : path.resolve(process.cwd(), fileArg);
  const raw = fs.readFileSync(abs, "utf8");
  const parsed = JSON.parse(raw);
  // Accept legacy key from docs; server expects website_or_social
  if (
    parsed.optional_website_or_social != null &&
    parsed.website_or_social == null
  ) {
    parsed.website_or_social = parsed.optional_website_or_social;
  }
  return { input: parsed, withStatus };
}

async function run() {
  const { input, withStatus } = loadInput();
  log.meta.input = input;

  console.log("\n🚀 Preflight pipeline\n");
  console.log("→ API:", API_BASE);

  await step("preflight-start", () => start(input));
  await step("preflight-recon", () => recon());
  await step("preflight-gbp", () => gbp());
  if (withStatus) {
    await step("preflight-status", () => status());
  }
  await step("preflight-preview", () => preview());

  runPreflightQa();
  printPreflightSummary();
  saveLog();
}

/**
 * @param {string} label
 * @param {() => Promise<void>} fn
 */
async function step(label, fn) {
  console.log(`\n▶️  ${label}`);
  console.time(label);
  try {
    await fn();
  } finally {
    console.timeEnd(label);
  }
}

/**
 * @param {typeof DEFAULT_INPUT} input
 */
async function start(input) {
  const res = await fetch(`${API_BASE}/preflight-start`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      business_name: input.business_name,
      city_or_service_area: input.city_or_service_area,
      description: input.description,
      website_or_social: input.website_or_social ?? "",
      client_email: input.client_email ?? ""
    })
  });

  const data = await readJsonResponse(res);
  log.start = { httpStatus: res.status, body: data };

  if (!res.ok || !data.ok) {
    throw new Error(
      `preflight-start failed: ${data.error || res.status} ${JSON.stringify(data).slice(0, 400)}`
    );
  }

  slug = data.slug;
  if (!slug) {
    throw new Error("preflight-start: missing slug in response");
  }
  console.log("✔ slug:", slug);
}

async function recon() {
  const res = await fetch(`${API_BASE}/preflight-recon`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ slug })
  });

  const data = await readJsonResponse(res);
  log.recon = { httpStatus: res.status, body: data };

  if (!res.ok || !data.ok) {
    throw new Error(`preflight-recon failed: ${data.error || res.status}`);
  }

  const preview = data.client_preview || {};
  console.log("✔ recon — client_preview headline:", preview.headline || preview.summary || "(see log)");
}

async function gbp() {
  const res = await fetch(`${API_BASE}/preflight-gbp`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ slug })
  });

  const data = await readJsonResponse(res);
  log.gbp = { httpStatus: res.status, body: data };

  if (!res.ok || !data.ok) {
    throw new Error(`preflight-gbp failed: ${data.error || res.status}`);
  }

  const audit = data.gbp_audit || data;
  console.log("✔ gbp_status:", audit.gbp_status ?? "(see log)");
}

async function status() {
  const res = await fetch(`${API_BASE}/preflight-status`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ slug })
  });

  const data = await readJsonResponse(res);
  log.status = { httpStatus: res.status, body: data };

  if (!res.ok || !data.ok) {
    throw new Error(`preflight-status failed: ${data.error || res.status}`);
  }

  console.log("✔ status snapshot stored (see log)");
}

async function preview() {
  const url = new URL(`${API_BASE}/preflight-preview`);
  url.searchParams.set("slug", slug);

  const res = await fetch(url.toString(), { method: "GET" });
  const data = await readJsonResponse(res);
  log.preview = { httpStatus: res.status, body: data };

  if (!res.ok || !data.ok) {
    throw new Error(`preflight-preview failed: ${data.error || res.status}`);
  }

  console.log("\n✨ Preview (selected fields):");
  const keys = [
    "business_understanding",
    "opportunity",
    "website_direction",
    "summary",
    "direction",
    "positioning"
  ];
  for (const k of keys) {
    if (data[k] != null && data[k] !== "") {
      console.log(`\n— ${k}:\n`, data[k]);
    }
  }
  if (!keys.some((k) => data[k] != null && data[k] !== "")) {
    console.log("(No known summary keys; full response is in the saved log.)");
  }
}

function runPreflightQa() {
  const previewB = log.preview?.body;
  const reconB = log.recon?.body;
  const gbpB = log.gbp?.body;
  const input = log.meta.input || {};

  if (!previewB || typeof previewB !== "object") return;

  const audit = gbpB?.gbp_audit ?? gbpB ?? {};
  const gbpStatus = audit.gbp_status;

  const opportunityPreview = previewB.opportunity;
  const opportunityRecon = reconB?.client_preview?.opportunity;
  const hasOpportunityInsight =
    present(opportunityPreview) || present(opportunityRecon);

  if (!hasOpportunityInsight) {
    qaWarn("Missing opportunity insight");
  }

  if (!present(previewB.business_understanding)) {
    qaWarn("Weak business understanding");
  }

  const previewBlob = previewTextBlob(previewB);
  if (!COMPETITOR_COMPARISON_HINT.test(previewBlob)) {
    qaWarn(
      "Preview has no competitor/alternative framing — specificity scores are capped at 70 until comparison language appears"
    );
  }

  const posScore = positioningSpecificityScore(previewB, input);
  const oppScore = opportunityStrengthScore(previewB, input);
  if (posScore < 45) {
    qaWarn(
      `Positioning language looks generic (specificity ${posScore}/100 — heuristic)`
    );
  }
  if (oppScore < 45) {
    qaWarn(
      `Opportunity text looks template-like (strength ${oppScore}/100 — heuristic)`
    );
  }

  const website = String(input.website_or_social || "").trim();
  const hasWebsite = /^https?:\/\//i.test(website);
  if (gbpStatus === "not_found") {
    qaWarn("No GBP detected");
    if (hasWebsite) {
      qaWarn(
        "GBP is not_found but a website URL was in the run input — possible false negative until Maps is verified"
      );
    }
  }
}

function printPreflightSummary() {
  const previewB = log.preview?.body || {};
  const reconB = log.recon?.body || {};
  const gbpB = log.gbp?.body || {};
  const input = log.meta.input || {};
  const audit = gbpB.gbp_audit || gbpB;
  const gbpStatus = audit.gbp_status ?? "unknown";

  const opportunityPreview = previewB.opportunity;
  const opportunityRecon = reconB.client_preview?.opportunity;
  const opportunityOk =
    present(opportunityPreview) || present(opportunityRecon);

  const positioningSpecificity = positioningSpecificityScore(previewB, input);
  const opportunityStrength = opportunityStrengthScore(previewB, input);

  log.meta.summary = {
    slug,
    gbp_status: gbpStatus,
    opportunity_present: opportunityOk,
    positioning_specificity_score: positioningSpecificity,
    opportunity_strength_score: opportunityStrength,
    positioning_specificity_label: strengthLabel(positioningSpecificity),
    opportunity_strength_label: strengthLabel(opportunityStrength),
    competitor_framing_detected: COMPETITOR_COMPARISON_HINT.test(
      previewTextBlob(previewB)
    )
  };

  console.log("\n🧾 PREFLIGHT SUMMARY");
  console.log(`- Slug: ${slug ?? "(none)"}`);
  console.log(`- GBP: ${gbpStatus}`);
  console.log(`- Opportunity (non-empty): ${opportunityOk ? "✔" : "⚠ missing"}`);
  console.log(
    `- Opportunity strength: ${opportunityStrength}/100 (${strengthLabel(opportunityStrength)} — heuristic)`
  );
  console.log(
    `- Positioning specificity: ${positioningSpecificity}/100 (${strengthLabel(positioningSpecificity)} — heuristic)`
  );
}

function saveLog() {
  log.meta.finished_at = new Date().toISOString();
  const filename = `preflight-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
  const filepath = path.join(logDir, filename);
  fs.writeFileSync(filepath, JSON.stringify(log, null, 2));
  console.log(`\n💾 Saved: ${filepath}\n`);
}

run().catch((err) => {
  console.error("\n❌ Preflight runner error:", err.message || err);
  try {
    log.meta.error = String(err?.message || err);
    log.meta.finished_at = new Date().toISOString();
    const filename = `preflight-error-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
    fs.writeFileSync(path.join(logDir, filename), JSON.stringify(log, null, 2));
    console.error(`Partial log: ${path.join(logDir, filename)}`);
  } catch {
    // ignore
  }
  process.exit(1);
});
