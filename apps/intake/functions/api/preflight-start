// apps/intake/functions/api/preflight-start.js
/**
 * SiteForge Factory — Pre-Flight Start Endpoint
 *
 * Purpose:
 * - accept minimal business input
 * - generate a stable slug
 * - initialize a pre-flight record shell
 * - return slug + lifecycle state
 *
 * Notes:
 * - this does NOT run recon yet
 * - this does NOT require payment
 * - this is the first entry point for Entity Recon
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

async function readJson(request) {
  try {
    return await request.json();
  } catch {
    return {};
  }
}

function cleanString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeSlug(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/'/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

function makeFallbackSlug() {
  const stamp = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 8);
  return `siteforge-${stamp}-${rand}`;
}

function buildSlugFromBusinessName(name) {
  const slug = normalizeSlug(name);
  return slug || makeFallbackSlug();
}

function nowIso() {
  return new Date().toISOString();
}

function createEmptyRecord({
  slug,
  businessName,
  cityOrServiceArea,
  description,
  websiteOrSocial,
  clientEmail
}) {
  const now = nowIso();

  return {
    schema_version: "FACTORY_RECORD_V1",
    slug,
    created_at: now,
    updated_at: now,

    lifecycle: {
      preflight_status: "in_progress",
      paid_status: "not_paid",
      paid_unlocked: false,
      paid_unlocked_at: "",
      intake_status: "locked",
      build_status: "not_started"
    },

    client: {
      input_business_name: businessName,
      canonical_business_name: "",
      client_email: clientEmail,
      city_or_service_area_input: cityOrServiceArea,
      description_input: description,
      optional_website_or_social: websiteOrSocial
    },

    entity_profile: {
      confidence: 0,
      source_urls: [],
      canonical_name: "",
      website_url: "",
      phone: "",
      address: "",
      service_area: [],
      business_model: "",
      primary_category: "",
      secondary_categories: [],
      strategic_archetype: "",
      vertical_complexity: "",
      one_page_fit: ""
    },

    gbp_audit: {
      gbp_status: "unknown",
      listing_found: false,
      listing_url: "",
      name_match_confidence: 0,
      nap: {
        name: "",
        phone: "",
        address: ""
      },
      completeness_score: 0,
      issues: [],
      recommended_improvements: [],
      creation_plan: {
        recommended_primary_category: "",
        recommended_secondary_categories: [],
        recommended_business_model: "",
        required_inputs_for_setup: []
      }
    },

    buyer_intelligence: {
      decision_factors: [],
      common_objections: [],
      trust_markers: [],
      red_flags_customers_avoid: []
    },

    preflight_strategy: {
      summary: "",
      primary_conversion: "",
      secondary_conversion: "",
      recommended_sections: [],
      faq_angles: [],
      aeo_angles: [],
      sales_preview: "",
      paid_phase_requirements: {
        must_verify_now: [],
        must_collect_paid_phase: [],
        nice_to_have_assets: []
      }
    },

    paid_intake: {
      seeded_from_preflight: false,
      verified_fields: {},
      answers: {},
      inference: {},
      ghostwritten_blocks: {},
      readiness: {
        can_generate_draft: false,
        can_generate_premium: false,
        missing_required: [],
        missing_premium: []
      }
    }
  };
}

/**
 * Stub persistence layer.
 *
 * Replace this with:
 * 1. Apps Script sheet write
 * 2. KV / D1 / R2
 * 3. GitHub file write
 *
 * For now, it simply returns the record unchanged.
 */
async function persistPreflightRecord(context, record) {
  return {
    ok: true,
    record
  };
}

export async function onRequest(context) {
    const { request, env } = context;
  
    if (request.method !== "POST") {
      return new Response(JSON.stringify({ ok: false, error: "Use POST /api/preflight-start" }), {
        status: 405,
        headers: { "content-type": "application/json" }
      });
    }
  
    try {
      const body = await request.json();
  
      const business_name = String(body.business_name || "").trim();
      const city_or_service_area = String(body.city_or_service_area || "").trim();
      const description = String(body.description || "").trim();
      const website_or_social = String(body.website_or_social || "").trim();
      const client_email = String(body.client_email || "").trim();
  
      if (!business_name) {
        return new Response(JSON.stringify({ ok: false, error: "Missing business_name" }), {
          status: 400,
          headers: { "content-type": "application/json" }
        });
      }
  
      if (!city_or_service_area) {
        return new Response(JSON.stringify({ ok: false, error: "Missing city_or_service_area" }), {
          status: 400,
          headers: { "content-type": "application/json" }
        });
      }
  
      if (!description) {
        return new Response(JSON.stringify({ ok: false, error: "Missing description" }), {
          status: 400,
          headers: { "content-type": "application/json" }
        });
      }
  
      const url = env.APPS_SCRIPT_WEBAPP_URL;
      const factoryKey = env.FACTORY_KEY;
  
      if (!url) throw new Error("Missing APPS_SCRIPT_WEBAPP_URL env var");
      if (!factoryKey) throw new Error("Missing FACTORY_KEY env var");
  
      const payload = {
        route: "preflight_start",
        factory_key: factoryKey,
        business_name,
        city_or_service_area,
        description,
        website_or_social,
        client_email
      };
  
      const res = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload)
      });
  
      const text = await res.text();
  
      return new Response(text, {
        status: res.status,
        headers: { "content-type": "application/json" }
      });
    } catch (err) {
      return new Response(JSON.stringify({ ok: false, error: String(err?.message || err) }), {
        status: 500,
        headers: { "content-type": "application/json" }
      });
    }
  }