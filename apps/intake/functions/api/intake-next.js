/**
 * SiteForge Factory Orchestrator (Google Apps Script)
 *
 * Responsibilities:
 * - Receive factory submissions from Cloudflare (/api/submit) -> validate FACTORY_KEY
 *   -> save sheet -> seed clients/{slug}/business.base.json in GitHub -> dispatch GitHub build
 * - Receive GitHub webhook workflow_run.completed -> download artifact -> deploy preview -> email dist.zip (optional)
 * - Receive preflight starts from Cloudflare -> save to Preflight sheet
 *
 * REQUIRED Script Properties:
 * - FACTORY_KEY
 * - GITHUB_TOKEN
 * - GITHUB_OWNER
 * - GITHUB_REPO
 * - WORKFLOW_FILE              (e.g. "build-client.yml")
 * - NETLIFY_TOKEN
 *
 * OPTIONAL Script Properties:
 * - GITHUB_WEBHOOK_SECRET      (only if you proxy and add shared secret into payload; header verification is not reliable in GAS)
 *
 * REQUIRED Sheets:
 * - "Clients"      (must include column "slug")
 * - "Submissions"
 * - "Preflight"    (must include column "slug")
 */

/* =========================
   Config Helpers
========================= */

function props_() { return PropertiesService.getScriptProperties(); }

function cfg_(key) {
  const v = props_().getProperty(key);
  if (!v) throw new Error("Missing Script Property: " + key);
  return v;
}

/* =========================
   JSON Response Helpers
========================= */

function json_(obj, codeOpt) {
  const payload = Object.assign({}, obj);
  if (codeOpt) payload.code = codeOpt;

  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}

/* =========================
   Sheets Helpers
========================= */

function clientsSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName("Clients");
  if (!sh) throw new Error('Missing sheet named "Clients"');
  return sh;
}

function submissionsSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName("Submissions");
  if (!sh) throw new Error('Missing sheet named "Submissions"');
  return sh;
}

function preflightSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName("Preflight");
  if (!sh) throw new Error('Missing sheet named "Preflight"');
  return sh;
}

function headers_(sheet) {
  const sh = sheet;
  return sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(String);
}

function findRowIndexBySlug_(slug) {
  const sh = clientsSheet_();
  const headers = headers_(sh);
  const slugCol = headers.indexOf("slug");
  if (slugCol === -1) throw new Error('Clients sheet missing column "slug"');

  const values = sh.getDataRange().getValues();
  for (let i = 1; i < values.length; i++) {
    if (String(values[i][slugCol]).trim() === String(slug).trim()) return i + 1;
  }
  return null;
}

function findRowIndexBySlugInSheet_(sheet, slug) {
  const sh = sheet;
  const headers = headers_(sh);
  const slugCol = headers.indexOf("slug");
  if (slugCol === -1) throw new Error('Sheet missing column "slug"');

  const values = sh.getDataRange().getValues();
  for (let i = 1; i < values.length; i++) {
    if (String(values[i][slugCol]).trim() === String(slug).trim()) return i + 1;
  }
  return null;
}

function getRowObject_(sheet, rowIndex) {
  const sh = sheet;
  const headers = headers_(sh);
  const row = sh.getRange(rowIndex, 1, 1, headers.length).getValues()[0];
  const obj = {};
  headers.forEach((h, i) => (obj[h] = row[i]));
  return obj;
}

function slugify_(value) {
  const s = String(value || "")
    .toLowerCase()
    .replace(/'/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");

  if (s) return s;

  const stamp = new Date().getTime().toString(36);
  const rand = Math.random().toString(36).slice(2, 8);
  return "siteforge-" + stamp + "-" + rand;
}

function upsertClient_(slug, patch) {
  const sh = clientsSheet_();
  const headers = headers_(sh);
  const now = new Date().toISOString();
  const data = { slug, ...patch, updated_at: now };
  let rowIndex = findRowIndexBySlug_(slug);

  if (!rowIndex) {
    const row = headers.map(h => (data[h] !== undefined ? data[h] : ""));
    sh.appendRow(row);
    return;
  }

  const existing = sh.getRange(rowIndex, 1, 1, headers.length).getValues()[0];
  const updated = headers.map((h, i) => (data[h] !== undefined ? data[h] : existing[i]));
  sh.getRange(rowIndex, 1, 1, headers.length).setValues([updated]);
}

function upsertPreflight_(slug, patch) {
  const sh = preflightSheet_();
  const headers = headers_(sh);
  const now = new Date().toISOString();

  const data = Object.assign({}, patch, {
    slug: slug,
    updated_at: now
  });

  let rowIndex = findRowIndexBySlugInSheet_(sh, slug);

  if (!rowIndex) {
    if (!data.created_at) data.created_at = now;
    const row = headers.map(h => (data[h] !== undefined ? data[h] : ""));
    sh.appendRow(row);
    return;
  }

  const existing = sh.getRange(rowIndex, 1, 1, headers.length).getValues()[0];
  const updated = headers.map((h, i) => (data[h] !== undefined ? data[h] : existing[i]));
  sh.getRange(rowIndex, 1, 1, headers.length).setValues([updated]);
}

function getPreflightBySlug_(slug) {
  const sh = preflightSheet_();
  const rowIndex = findRowIndexBySlugInSheet_(sh, slug);
  if (!rowIndex) return null;
  return getRowObject_(sh, rowIndex);
}

function saveSubmissionToSheet_(slug, body) {
  const sh = submissionsSheet_();
  const headers = headers_(sh);

  const now = new Date().toISOString();
  const rowObj = {
    created_at: now,
    updated_at: now,
    slug: slug,
    client_email: body.client_email || "",
    status: "PENDING",
    github_run_id: "",
    preview_url: "",
    last_error: "",
    payload_json: JSON.stringify(body)
  };

  const row = headers.map(h => (rowObj[h] !== undefined ? rowObj[h] : ""));
  sh.appendRow(row);
  return sh.getLastRow();
}

function updateLatestSubmissionBySlug_(slug, patch) {
  const sh = submissionsSheet_();
  const headers = headers_(sh);
  const slugCol = headers.indexOf("slug");
  if (slugCol === -1) throw new Error('Submissions sheet missing column "slug"');

  const values = sh.getDataRange().getValues();
  let rowIndex = null;

  for (let i = values.length - 1; i >= 1; i--) {
    if (String(values[i][slugCol]).trim() === String(slug).trim()) {
      rowIndex = i + 1;
      break;
    }
  }

  if (!rowIndex) return;

  const existing = sh.getRange(rowIndex, 1, 1, headers.length).getValues()[0];
  const withTimestamp = Object.assign({}, patch, { updated_at: new Date().toISOString() });
  const next = headers.map((h, i) => (h in withTimestamp ? withTimestamp[h] : existing[i]));
  sh.getRange(rowIndex, 1, 1, headers.length).setValues([next]);
}

function getClientStatusBySlug_(slug) {
  const rowIndex = findRowIndexBySlug_(slug);
  if (!rowIndex) return null;

  const row = getRowObject_(clientsSheet_(), rowIndex);

  return {
    ok: true,
    slug: String(row.slug || ""),
    status: String(row.factory_status || ""),
    preview_url: String(row.preview_url || ""),
    last_preview_deploy_url: String(row.last_preview_deploy_url || ""),
    github_run_id: String(row.github_run_id || ""),
    last_error: String(row.last_error || ""),
    updated_at: String(row.updated_at || "")
  };
}

/* =========================
   GitHub API Helpers
========================= */

function githubRequest_(method, path, body) {
  const url = "https://api.github.com" + path;
  const options = {
    method: method,
    headers: {
      Authorization: "Bearer " + cfg_("GITHUB_TOKEN"),
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28"
    },
    muteHttpExceptions: true
  };
  if (body !== undefined) {
    options.contentType = "application/json";
    options.payload = JSON.stringify(body);
  }
  const res = UrlFetchApp.fetch(url, options);
  const code = res.getResponseCode();
  if (code < 200 || code >= 300) throw new Error("GitHub API error " + code + ": " + res.getContentText());
  return JSON.parse(res.getContentText() || "{}");
}

/**
 * Create/overwrite a file in the repo using GitHub Contents API.
 * Writes to main branch by default (via API).
 */
function githubPutFile_(repoPath, contentString, message, overwrite) {
  const owner = cfg_("GITHUB_OWNER");
  const repo = cfg_("GITHUB_REPO");
  const token = cfg_("GITHUB_TOKEN");

  const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${repoPath}?ref=main`;

  let sha = null;
  const existing = UrlFetchApp.fetch(apiUrl, {
    method: "get",
    headers: {
      Authorization: "Bearer " + token,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28"
    },
    muteHttpExceptions: true
  });

  const existingCode = existing.getResponseCode();
  if (existingCode === 200) {
    if (!overwrite) return { skipped: true };
    sha = JSON.parse(existing.getContentText() || "{}").sha || null;
  } else if (existingCode !== 404) {
    throw new Error("GitHub file lookup error " + existingCode + ": " + existing.getContentText());
  }

  const payload = {
    message: message,
    content: Utilities.base64Encode(contentString),
    branch: "main",
    ...(sha ? { sha: sha } : {})
  };

  const res = UrlFetchApp.fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${repoPath}`, {
    method: "put",
    headers: {
      Authorization: "Bearer " + token,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28"
    },
    contentType: "application/json",
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  });

  const code = res.getResponseCode();
  const text = res.getContentText();
  if (code < 200 || code >= 300) throw new Error("GitHub PUT failed " + code + ": " + text);

  const out = JSON.parse(text || "{}");
  return { ok: true, commit_sha: out?.commit?.sha || "" };
}

function dispatchBuild_(slug) {
  const owner = cfg_("GITHUB_OWNER");
  const repo = cfg_("GITHUB_REPO");
  const workflowFile = cfg_("WORKFLOW_FILE");

  githubRequest_("post", `/repos/${owner}/${repo}/actions/workflows/${workflowFile}/dispatches`, {
    ref: "main",
    inputs: { client_slug: slug }
  });
}

function listArtifactsForRun_(runId) {
  const owner = cfg_("GITHUB_OWNER");
  const repo = cfg_("GITHUB_REPO");
  return githubRequest_("get", `/repos/${owner}/${repo}/actions/runs/${runId}/artifacts`);
}

/**
 * Download a GitHub Actions artifact zip.
 * GitHub often returns a redirect here; follow it manually WITHOUT
 * forwarding the GitHub Authorization header to the storage URL.
 */
function downloadArtifactZip_(artifactId) {
  const owner = cfg_("GITHUB_OWNER");
  const repo = cfg_("GITHUB_REPO");
  const token = cfg_("GITHUB_TOKEN");
  const zipUrl = `https://api.github.com/repos/${owner}/${repo}/actions/artifacts/${artifactId}/zip`;

  const res = UrlFetchApp.fetch(zipUrl, {
    method: "get",
    headers: {
      Authorization: "Bearer " + token,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28"
    },
    muteHttpExceptions: true,
    followRedirects: false
  });

  const code = res.getResponseCode();

  if (code === 301 || code === 302 || code === 303 || code === 307 || code === 308) {
    const headers = res.getAllHeaders();
    const redirectUrl = headers.Location || headers.location;

    if (!redirectUrl) {
      throw new Error("Artifact download redirect missing Location header");
    }

    const redirected = UrlFetchApp.fetch(redirectUrl, {
      method: "get",
      muteHttpExceptions: true
    });

    const redirectedCode = redirected.getResponseCode();
    if (redirectedCode < 200 || redirectedCode >= 300) {
      throw new Error("Artifact redirected download failed " + redirectedCode + ": " + redirected.getContentText());
    }

    return redirected.getBlob().setName("artifact.zip");
  }

  if (code < 200 || code >= 300) {
    throw new Error("Artifact download failed " + code + ": " + res.getContentText());
  }

  return res.getBlob().setName("artifact.zip");
}

function extractDistZipFromArtifact_(artifactZipBlob) {
  const files = Utilities.unzip(artifactZipBlob);
  const distFile = files.find(f => f.getName() === "dist.zip");
  if (!distFile) throw new Error("dist.zip missing inside artifact zip");
  return distFile;
}

/* =========================
   Netlify Helpers
========================= */

function createPreviewSite_(slug) {
  const name = "preview-" + String(slug).toLowerCase().replace(/[^a-z0-9]/g, "-").slice(0, 50);
  const res = UrlFetchApp.fetch("https://api.netlify.com/api/v1/sites", {
    method: "post",
    headers: { Authorization: "Bearer " + cfg_("NETLIFY_TOKEN") },
    contentType: "application/json",
    payload: JSON.stringify({ name, created_via: "siteforge-factory" }),
    muteHttpExceptions: true
  });

  const code = res.getResponseCode();
  if (code < 200 || code >= 300) throw new Error("Netlify create site error " + code + ": " + res.getContentText());

  const site = JSON.parse(res.getContentText());
  return { site_id: site.id, url: site.url, admin_url: site.admin_url };
}

function ensurePreviewSiteExists_(slug) {
  const rowIndex = findRowIndexBySlug_(slug);
  if (rowIndex) {
    const row = getRowObject_(clientsSheet_(), rowIndex);
    const previewSiteId = String(row.preview_site_id || "").trim();
    if (previewSiteId) {
      return { site_id: previewSiteId, url: row.preview_url || "" };
    }
  }

  const created = createPreviewSite_(slug);
  upsertClient_(slug, {
    preview_site_id: created.site_id,
    preview_url: String(created.url || "").replace(/^http:\/\//, "https://"),
    preview_admin_url: created.admin_url
  });
  return created;
}

function deployZipToNetlify_(siteId, zipBlob) {
  const url = `https://api.netlify.com/api/v1/sites/${siteId}/deploys`;
  const res = UrlFetchApp.fetch(url, {
    method: "post",
    headers: {
      Authorization: "Bearer " + cfg_("NETLIFY_TOKEN"),
      "Content-Type": "application/zip"
    },
    payload: zipBlob.getBytes(),
    muteHttpExceptions: true
  });

  const code = res.getResponseCode();
  if (code < 200 || code >= 300) throw new Error("Netlify deploy error " + code + ": " + res.getContentText());

  return JSON.parse(res.getContentText());
}

function deployPreviewToNetlify_(slug, distZipBlob) {
  const site = ensurePreviewSiteExists_(slug);
  const deploy = deployZipToNetlify_(site.site_id, distZipBlob);

  const previewUrl = String(site.url || deploy.deploy_url || "").replace(/^http:\/\//, "https://");
  const deployUrl = String(deploy.deploy_url || "").replace(/^http:\/\//, "https://");

  upsertClient_(slug, {
    preview_url: previewUrl,
    last_preview_deploy_url: deployUrl
  });

  return previewUrl || deployUrl || "";
}

/* =========================
   Optional Emailer
========================= */

function emailDistZipIfNeeded_(slug, distZipBlob) {
  // no-op for now (your roadmap)
}

/* =========================
   Webhook / Submission Router
========================= */

function doPost(e) {
  try {
    if (!e || !e.postData) return json_({ ok: false, error: "No post data" }, 400);

    const contentType = String(e.postData.type || "");
    const raw = String(e.postData.contents || "");
    const isJson = contentType.includes("application/json");

    let payload = null;
    if (isJson && raw) payload = JSON.parse(raw);

    // 1) GitHub workflow_run webhook
    if (payload && payload.workflow_run) {
      return handleGitHubWebhook_(payload);
    }

    // 2) Must be JSON for all other routes
    if (!payload) return json_({ ok: false, error: "Expected JSON body" }, 400);

    // 3) Routed requests
    const route = String(payload.route || "").trim();

    if (route === "preflight_start") {
      return handlePreflightStart_(payload);
    }

    if (route === "preflight_status") {
      return handlePreflightStatus_(payload);
    }

    if (route === "preflight_update") {
      return handlePreflightUpdate_(payload);
    }

    if (route === "preflight_recon") {
      return handlePreflightRecon_(payload);
    }

    if (route === "preflight_gbp") {
      return handlePreflightGbp_(payload);
    }

    if (route === "preflight_preview") {
      return json_(handlePreflightPreview_(payload), 200);
    } 


    // 4) Default to existing factory submission behavior
    return handleFactorySubmission_(payload);

  } catch (err) {
    return json_({ ok: false, error: String(err) }, 500);
  }
}

function doGet(e) {
  try {
    const slug = String((e && e.parameter && e.parameter.slug) || "").trim();

    if (!slug) {
      return json_({ ok: false, error: "Missing slug" }, 400);
    }

    const status = getClientStatusBySlug_(slug);
    if (!status) {
      return json_({ ok: false, error: "Slug not found", slug: slug }, 404);
    }

    return json_(status, 200);
  } catch (err) {
    return json_({ ok: false, error: String(err) }, 500);
  }
}

/**
 * Optional shared-secret check. (Header signature verification is best done in a Cloudflare Worker proxy.)
 * If GITHUB_WEBHOOK_SECRET is set, require payload.secret === it.
 */
function verifyWebhook_(payload) {
  const secret = props_().getProperty("GITHUB_WEBHOOK_SECRET");
  if (!secret) return true;
  return payload && payload.secret && String(payload.secret) === String(secret);
}

/* =========================
   Status Helpers
========================= */

function markFailure_(slug, message, extraPatch) {
  const patch = Object.assign({
    factory_status: "FAILED",
    last_error: message
  }, extraPatch || {});

  if (slug) {
    upsertClient_(slug, patch);
    updateLatestSubmissionBySlug_(slug, {
      status: "FAILED",
      last_error: message
    });
  }
}

/* =========================
   Handlers
========================= */

function handlePreflightStart_(body) {
  const factoryKey = cfg_("FACTORY_KEY");

  if (!body.factory_key || String(body.factory_key) !== String(factoryKey)) {
    return json_({ ok: false, error: "Unauthorized" }, 401);
  }

  const businessName = String(body.business_name || "").trim();
  const cityOrServiceArea = String(body.city_or_service_area || "").trim();
  const description = String(body.description || "").trim();
  const websiteOrSocial = String(body.website_or_social || "").trim();
  const clientEmail = String(body.client_email || "").trim();

  if (!businessName) {
    return json_({ ok: false, error: "Missing business_name" }, 400);
  }

  if (!cityOrServiceArea) {
    return json_({ ok: false, error: "Missing city_or_service_area" }, 400);
  }

  if (!description) {
    return json_({ ok: false, error: "Missing description" }, 400);
  }

  const slug = slugify_(businessName);
  const existing = getPreflightBySlug_(slug);

  if (existing) {
    return json_({
      ok: true,
      slug: slug,
      preflight_status: String(existing.preflight_status || "in_progress"),
      paid_unlocked: String(existing.paid_unlocked || "") === "true",
      intake_status: String(existing.intake_status || "locked"),
      message: "Pre-flight already exists for this slug."
    }, 200);
  }

  upsertPreflight_(slug, {
    created_at: new Date().toISOString(),

    preflight_status: "in_progress",
    paid_status: "not_paid",
    paid_unlocked: false,
    paid_unlocked_at: "",
    intake_status: "locked",
    build_status: "not_started",

    input_business_name: businessName,
    canonical_business_name: "",
    client_email: clientEmail,
    city_or_service_area_input: cityOrServiceArea,
    description_input: description,
    optional_website_or_social: websiteOrSocial,

    entity_profile_json: JSON.stringify({}),
    gbp_audit_json: JSON.stringify({}),
    buyer_intelligence_json: JSON.stringify({}),
    preflight_strategy_json: JSON.stringify({}),
    paid_intake_json: JSON.stringify({}),

    last_error: ""
  });

  return json_({
    ok: true,
    slug: slug,
    preflight_status: "in_progress",
    paid_unlocked: false,
    intake_status: "locked",
    message: "Pre-flight started."
  }, 200);
}


function handlePreflightRecon_(body) {
  const slug = String(body.slug || "").trim();
  const entityProfile = body.entity_profile || {};
  const buyerIntel = body.buyer_intelligence || {};
  const internalStrategy = body.internal_strategy || {};
  const clientPreview = body.client_preview || {};

  if (!slug) {
    return json_({ ok: false, error: "Missing slug" }, 400);
  }

  const existing = getPreflightBySlug_(slug);
  if (!existing) {
    return json_({ ok: false, error: "Slug not found" }, 404);
  }

  function isPlainObject_(value) {
    return value && typeof value === "object" && !Array.isArray(value);
  }

  function isEmptyObject_(value) {
    return !isPlainObject_(value) || Object.keys(value).length === 0;
  }

  if (
    isEmptyObject_(entityProfile) &&
    isEmptyObject_(buyerIntel) &&
    isEmptyObject_(internalStrategy) &&
    isEmptyObject_(clientPreview)
  ) {
    upsertPreflight_(slug, {
      preflight_status: "recon_failed",
      last_error: "Recon payload was empty"
    });

    return json_({
      ok: false,
      error: "Recon payload was empty",
      slug: slug
    }, 422);
  }

  upsertPreflight_(slug, {
    entity_profile_json: JSON.stringify(entityProfile),
    buyer_intelligence_json: JSON.stringify(buyerIntel),
    preflight_strategy_json: JSON.stringify({
      internal_strategy: internalStrategy,
      client_preview: clientPreview
    }),
    preflight_status: "recon_complete",
    last_error: ""
  });

  return json_({
    ok: true,
    slug: slug,
    preflight_status: "recon_complete"
  }, 200);
}

function safeParse_(value) {
  try {
    return JSON.parse(String(value || "{}"));
  } catch (err) {
    return {};
  }
}

function handlePreflightPreview_(body) {
  const slug = String(body.slug || "").trim();

  if (!slug) {
    return { ok: false, error: "Missing slug" };
  }

  const row = getPreflightBySlug_(slug);
  if (!row) {
    return { ok: false, error: "Record not found" };
  }

  const strategy = safeParse_(row.preflight_strategy_json);
  const gbp = safeParse_(row.gbp_audit_json);

  const clientPreview = strategy.client_preview || {};

  return {
    ok: true,
    slug: slug,

    business_understanding:
      clientPreview.summary ||
      "We analyzed your business and identified strong positioning opportunities.",

    opportunity:
      clientPreview.opportunity ||
      "There appears to be an opportunity to improve how customers discover and book your services online.",

    website_direction:
      clientPreview.sales_preview ||
      "A focused website built around your services and customer experience could improve conversions.",

    google_presence_insight:
      gbp.gbp_status === "not_found"
        ? "Your business does not appear to have a fully established Google Business presence yet. Aligning that with your website can improve local discovery."
        : "Your Google presence may benefit from better alignment with how customers search for your services.",

    recommended_focus:
      clientPreview.recommended_focus || [],

    next_step:
      clientPreview.next_step_teaser ||
      "In the build phase we refine your messaging, structure the website for conversions, and align your web presence with customer search behavior."
  };
}

function handlePreflightUpdate_(body) {
  const slug = String(body.slug || "").trim();

  if (!slug) {
    return json_({ ok: false, error: "Missing slug" }, 400);
  }

  const existing = getPreflightBySlug_(slug);
  if (!existing) {
    return json_({ ok: false, error: "Slug not found" }, 404);
  }

  const patch = {};

  const allowedFields = [
    "preflight_status",
    "paid_status",
    "paid_unlocked",
    "paid_unlocked_at",
    "intake_status",
    "build_status",
    "canonical_business_name",
    "client_email",
    "entity_profile_json",
    "buyer_intelligence_json",
    "preflight_strategy_json",
    "gbp_audit_json",
    "paid_intake_json",
    "last_error"
  ];

  allowedFields.forEach(function(field) {
    if (body[field] !== undefined) {
      patch[field] = body[field];
    }
  });

  if (patch.paid_unlocked !== undefined) {
    const raw = String(patch.paid_unlocked).trim().toLowerCase();
    patch.paid_unlocked = raw === "true" || raw === "1";
  }

  if (patch.paid_status === "paid" && !patch.paid_unlocked_at && !existing.paid_unlocked_at) {
    patch.paid_unlocked_at = new Date().toISOString();
  }

  upsertPreflight_(slug, patch);

  const updated = getPreflightBySlug_(slug);

  return json_({
    ok: true,
    slug: slug,
    preflight_status: String(updated.preflight_status || ""),
    paid_status: String(updated.paid_status || ""),
    paid_unlocked: String(updated.paid_unlocked || "").toLowerCase() === "true" || updated.paid_unlocked === true,
    paid_unlocked_at: String(updated.paid_unlocked_at || ""),
    intake_status: String(updated.intake_status || ""),
    build_status: String(updated.build_status || "")
  }, 200);
}

function handleFactorySubmission_(body) {
  const factoryKey = cfg_("FACTORY_KEY");

  if (!body.factory_key || String(body.factory_key) !== String(factoryKey)) {
    return json_({ ok: false, error: "Unauthorized" }, 401);
  }

  const slug = body.business_json?.brand?.slug;
  if (!slug) return json_({ ok: false, error: "Missing business_json.brand.slug" }, 400);

  saveSubmissionToSheet_(slug, body);

  upsertClient_(slug, {
    client_email: body.client_email || "",
    factory_status: "PENDING",
    last_error: ""
  });

  updateLatestSubmissionBySlug_(slug, {
    status: "PENDING",
    last_error: ""
  });

  // Seed base.json before build
  const repoPath = `clients/${slug}/business.base.json`;
  const content = JSON.stringify(body.business_json, null, 2);

  let seed;
  try {
    seed = githubPutFile_(repoPath, content, `Factory: seed business.base.json for ${slug}`, true);
  } catch (err) {
    markFailure_(slug, "Failed to seed business.base.json: " + String(err));
    return json_({ ok: false, error: "Failed to seed base.json", detail: String(err) }, 500);
  }

  // Small delay to avoid immediate visibility edge cases
  Utilities.sleep(2000);

  try {
    dispatchBuild_(slug);
  } catch (err) {
    markFailure_(slug, "Failed to dispatch build: " + String(err));
    return json_({ ok: false, error: "Failed to dispatch build", detail: String(err) }, 500);
  }

  upsertClient_(slug, {
    factory_status: "BUILD_DISPATCHED",
    last_error: ""
  });

  updateLatestSubmissionBySlug_(slug, {
    status: "BUILD_DISPATCHED",
    last_error: ""
  });

  return json_({
    ok: true,
    message: "Base seeded + build dispatched",
    slug: slug,
    seed_commit_sha: seed.commit_sha || ""
  }, 200);
}


function handlePreflightStatus_(body) {
  const slug = String(body.slug || "").trim();

  if (!slug) {
    return json_({ ok: false, error: "Missing slug" }, 400);
  }

  const row = getPreflightBySlug_(slug);

  if (!row) {
    return json_({
      ok: false,
      error: "Slug not found",
      slug: slug
    }, 404);
  }

  return json_({
    ok: true,
    slug: slug,

    preflight_status: String(row.preflight_status || ""),
    paid_status: String(row.paid_status || ""),
    paid_unlocked: String(row.paid_unlocked || "") === "true" || row.paid_unlocked === true,
    intake_status: String(row.intake_status || ""),
    build_status: String(row.build_status || ""),

    input_business_name: String(row.input_business_name || ""),
    canonical_business_name: String(row.canonical_business_name || ""),
    client_email: String(row.client_email || ""),
    city_or_service_area_input: String(row.city_or_service_area_input || ""),
    description_input: String(row.description_input || ""),
    optional_website_or_social: String(row.optional_website_or_social || ""),

    entity_profile_json: String(row.entity_profile_json || "{}"),
    buyer_intelligence_json: String(row.buyer_intelligence_json || "{}"),
    preflight_strategy_json: String(row.preflight_strategy_json || "{}"),
    gbp_audit_json: String(row.gbp_audit_json || "{}"),
    paid_intake_json: String(row.paid_intake_json || "{}"),

    updated_at: String(row.updated_at || ""),
    last_error: String(row.last_error || "")
  }, 200);
}

function handlePreflightGbp_(body) {
  const slug = String(body.slug || "").trim();
  const gbpAudit = body.gbp_audit || {};

  if (!slug) {
    return json_({ ok: false, error: "Missing slug" }, 400);
  }

  const existing = getPreflightBySlug_(slug);
  if (!existing) {
    return json_({ ok: false, error: "Slug not found" }, 404);
  }

  function isPlainObject_(value) {
    return value && typeof value === "object" && !Array.isArray(value);
  }

  function isEmptyObject_(value) {
    return !isPlainObject_(value) || Object.keys(value).length === 0;
  }

  if (isEmptyObject_(gbpAudit)) {
    upsertPreflight_(slug, {
      last_error: "GBP audit payload was empty"
    });

    return json_({
      ok: false,
      error: "GBP audit payload was empty",
      slug: slug
    }, 422);
  }

  upsertPreflight_(slug, {
    gbp_audit_json: JSON.stringify(gbpAudit),
    last_error: ""
  });

  return json_({
    ok: true,
    slug: slug,
    gbp_status: String(gbpAudit.gbp_status || "")
  }, 200);
}


function handleGitHubWebhook_(payload) {
  if (!verifyWebhook_(payload)) return json_({ ok: false, error: "Webhook unauthorized" }, 401);

  const run = payload.workflow_run;
  if (!run) return json_({ ok: true, ignored: "No workflow_run" });

  if (String(run.status) !== "completed") {
    return json_({ ok: true, ignored: "Run not completed", status: run.status });
  }

  const runName = String(run.name || "");
  const slug = runName.startsWith("build-") ? runName.slice("build-".length).trim() : "";

  if (!slug) {
    return json_({ ok: false, error: "Could not derive slug from run.name", run_name: runName }, 400);
  }

  if (String(run.conclusion) !== "success") {
    markFailure_(slug, "GitHub run did not succeed: " + String(run.conclusion), {
      github_run_id: String(run.id || "")
    });
    return json_({ ok: true, ignored: "Run not successful", conclusion: run.conclusion });
  }

  upsertClient_(slug, {
    factory_status: "BUILD_SUCCEEDED",
    github_run_id: String(run.id || ""),
    last_error: ""
  });

  updateLatestSubmissionBySlug_(slug, {
    status: "BUILD_SUCCEEDED",
    github_run_id: String(run.id || ""),
    last_error: ""
  });

  // List artifacts
  let artifacts;
  try {
    artifacts = listArtifactsForRun_(run.id);
  } catch (err) {
    markFailure_(slug, "Failed listing artifacts: " + String(err), {
      github_run_id: String(run.id || "")
    });
    return json_({ ok: false, error: "Failed listing artifacts", detail: String(err) }, 500);
  }

  const want = "dist-" + slug;
  const artifact = (artifacts.artifacts || []).find(a => a.name === want);

  if (!artifact) {
    markFailure_(slug, "Artifact not found: " + want, {
      github_run_id: String(run.id || "")
    });
    return json_({
      ok: false,
      error: "Artifact not found",
      expected: want,
      available: (artifacts.artifacts || []).map(a => a.name)
    }, 404);
  }

  // Download artifact zip
  let artifactZipBlob;
  try {
    artifactZipBlob = downloadArtifactZip_(artifact.id);
  } catch (err) {
    markFailure_(slug, "Artifact download failed: " + String(err), {
      github_run_id: String(run.id || "")
    });
    return json_({ ok: false, error: "Artifact download failed", detail: String(err) }, 500);
  }

  // Extract inner dist.zip
  let distZip;
  try {
    distZip = extractDistZipFromArtifact_(artifactZipBlob);
  } catch (err) {
    markFailure_(slug, "dist.zip extraction failed: " + String(err), {
      github_run_id: String(run.id || "")
    });
    return json_({ ok: false, error: "dist.zip extraction failed", detail: String(err) }, 500);
  }

  // Deploy preview
  let previewUrl;
  try {
    previewUrl = deployPreviewToNetlify_(slug, distZip);
  } catch (err) {
    markFailure_(slug, "Preview deploy failed: " + String(err), {
      github_run_id: String(run.id || "")
    });
    return json_({ ok: false, error: "Preview deploy failed", detail: String(err) }, 500);
  }

  const previewUrlHttps = String(previewUrl || "").replace(/^http:\/\//, "https://");

  upsertClient_(slug, {
    preview_url: previewUrlHttps,
    factory_status: "PREVIEW_DEPLOYED",
    github_run_id: String(run.id || ""),
    last_error: ""
  });

  updateLatestSubmissionBySlug_(slug, {
    status: "PREVIEW_DEPLOYED",
    preview_url: previewUrlHttps,
    github_run_id: String(run.id || ""),
    last_error: ""
  });

  try { emailDistZipIfNeeded_(slug, distZip); } catch (e) {}

  return json_({ ok: true, slug, preview_url: previewUrlHttps }, 200);
}

/* =========================
   Optional test helpers
========================= */

function testGitHubActionTrigger() {
  dispatchBuild_("aura-electric-solar");
}

function testPreflightStart() {
  const payload = {
    route: "preflight_start",
    factory_key: cfg_("FACTORY_KEY"),
    business_name: "Captain Bob Tours",
    city_or_service_area: "Marco Island, FL",
    description: "Private boat tours and dolphin watching",
    website_or_social: "",
    client_email: ""
  };

  Logger.log(handlePreflightStart_(payload).getContent());
}