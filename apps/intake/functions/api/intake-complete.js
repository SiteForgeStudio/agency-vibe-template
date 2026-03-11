/**
 * intake-complete.js
 *
 * SiteForge Factory — Conversational Intake Complete Endpoint
 *
 * Purpose:
 * - validate intake state
 * - synthesize strategy brief
 * - call existing /api/generate
 * - call existing /api/submit
 * - return generation + submit kickoff payloads
 */

export async function onRequestPost(context) {
  try {
    const body = await readJson(context.request);

    const sessionId = cleanString(body.session_id);
    const state = isObject(body.state) ? body.state : {};
    const force = Boolean(body.force);

    if (!sessionId) {
      return json({ ok: false, error: "Missing session_id" }, 400);
    }

    const businessName = cleanString(state.businessName);
    const clientEmail = cleanString(state.clientEmail);

    if (!businessName) {
      return json({ ok: false, error: "Missing businessName in state" }, 400);
    }

    const readiness = evaluateReadiness(state);

    if (!force && !readiness.can_generate_now) {
      const hasSomeStrategy =
        cleanString(state.answers?.why_now) ||
        cleanString(state.answers?.desired_outcome) ||
        cleanString(state.answers?.target_audience) ||
        (Array.isArray(state.answers?.offerings) && state.answers.offerings.length);

      if (!hasSomeStrategy) {
        return json({
          ok: false,
          error: "Intake not ready for generation",
          readiness,
          missing_domains: readiness.missing_domains
        }, 400);
      }
    }

    const strategyBrief = synthesizeStrategyBrief(state);

    const generatePayload = {
      businessName,
      clientEmail,
      story: strategyBrief
    };

    const generateResponse = await callGenerateEndpoint({
      request: context.request,
      payload: generatePayload
    });

    const submitPayload = {
      business_json: generateResponse.business_json,
      client_email: clientEmail || generateResponse.business_json?.brand?.email || ""
    };

    const submitResponse = await callSubmitEndpoint({
      request: context.request,
      payload: submitPayload
    });

    return json({
      ok: true,
      session_id: sessionId,
      readiness,
      strategy_brief: strategyBrief,
      generated: generateResponse,
      submitted: submitResponse,
      slug:
        generateResponse.client_slug ||
        generateResponse.slug ||
        generateResponse.business_json?.brand?.slug ||
        submitResponse.slug ||
        ""
    });

  } catch (err) {
    return json({
      ok: false,
      error: String(err?.message || err)
    }, 500);
  }
}

export async function onRequestGet() {
  return json({
    ok: true,
    endpoint: "intake-complete",
    method: "POST"
  });
}


/* --------------------------------
   GENERATE HANDOFF
-------------------------------- */

async function callGenerateEndpoint({ request, payload }) {
  const url = new URL(request.url);
  url.pathname = "/api/generate";
  url.search = "";

  const res = await fetch(url.toString(), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload)
  });

  const text = await res.text();

  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error("Generate endpoint returned non JSON");
  }

  if (!res.ok || !data.ok) {
    throw new Error(data.error || "Generate endpoint failed");
  }

  return data;
}


/* --------------------------------
   SUBMIT HANDOFF
-------------------------------- */

async function callSubmitEndpoint({ request, payload }) {
  const url = new URL(request.url);
  url.pathname = "/api/submit";
  url.search = "";

  const res = await fetch(url.toString(), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload)
  });

  const text = await res.text();

  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error("Submit endpoint returned non JSON");
  }

  if (!res.ok || !data.ok) {
    throw new Error(data.error || "Submit endpoint failed");
  }

  return data;
}


/* --------------------------------
   STRATEGY BRIEF SYNTHESIS
-------------------------------- */

function synthesizeStrategyBrief(state) {
  const name = cleanString(state.businessName) || "This business";

  const whyNow = cleanString(state.answers?.why_now);
  const desiredOutcome = cleanString(state.answers?.desired_outcome);
  const audience = cleanString(state.answers?.target_audience);
  const offer = cleanList(state.answers?.offerings);
  const differentiators = cleanList(state.answers?.differentiators);
  const trustSignals = cleanList(state.answers?.trust_signals);
  const credibility = cleanList(state.answers?.credibility_factors);
  const cta = cleanString(state.answers?.primary_conversion_goal);
  const vibe = cleanString(state.inference?.suggested_vibe);
  const firstImpression = cleanString(state.answers?.first_impression_goal);
  const tone = cleanString(state.answers?.tone_preferences || state.inference?.tone_direction);
  const visualDirection = cleanString(state.answers?.visual_direction || state.inference?.visual_direction);
  const components = cleanList(state.inference?.suggested_components);
  const serviceArea = cleanString(state.answers?.service_area);

  const ghostTagline = cleanString(state.ghostwritten?.tagline);
  const ghostHeroHeadline = cleanString(state.ghostwritten?.hero_headline);
  const ghostHeroSubheadline = cleanString(state.ghostwritten?.hero_subheadline);
  const ghostAboutSummary = cleanString(state.ghostwritten?.about_summary);

  const parts = [];

  parts.push(name + " needs a premium conversion-focused website.");

  if (whyNow) {
    parts.push("The site is being created now because " + stripTrailingPeriod(whyNow) + ".");
  }

  if (desiredOutcome) {
    parts.push("The main goal of the site is to " + stripTrailingPeriod(desiredOutcome) + ".");
  }

  if (audience) {
    parts.push("The site should attract " + stripTrailingPeriod(audience) + ".");
  }

  if (offer.length) {
    parts.push("The business focuses on " + joinSentence(offer) + ".");
  }

  if (differentiators.length) {
    parts.push("The business stands out because of " + joinSentence(differentiators) + ".");
  }

  const trust = [...trustSignals, ...credibility];
  if (trust.length) {
    parts.push("Trust should be reinforced through " + joinSentence(trust) + ".");
  }

  if (cta) {
    parts.push("The primary call to action should encourage visitors to " + stripTrailingPeriod(cta) + ".");
  }

  if (firstImpression) {
    parts.push("The first impression should feel " + stripTrailingPeriod(firstImpression) + ".");
  }

  if (vibe) {
    parts.push("The overall visual vibe should feel " + stripTrailingPeriod(vibe) + ".");
  }

  if (tone) {
    parts.push("The tone should feel " + stripTrailingPeriod(tone) + ".");
  }

  if (visualDirection) {
    parts.push("The visual direction should reflect " + stripTrailingPeriod(visualDirection) + ".");
  }

  if (serviceArea) {
    parts.push("The business serves " + stripTrailingPeriod(serviceArea) + ".");
  }

  if (components.length) {
    parts.push("Recommended sections include " + joinSentence(components) + ".");
  }

  const approvedMessaging = [];
  if (ghostTagline) approvedMessaging.push('tagline "' + ghostTagline + '"');
  if (ghostHeroHeadline) approvedMessaging.push('hero headline "' + ghostHeroHeadline + '"');
  if (ghostHeroSubheadline) approvedMessaging.push('hero subheadline "' + ghostHeroSubheadline + '"');
  if (ghostAboutSummary) approvedMessaging.push('about summary "' + ghostAboutSummary + '"');

  if (approvedMessaging.length) {
    parts.push("Suggested messaging includes " + joinSentence(approvedMessaging) + ".");
  }

  parts.push("Use this strategy brief to generate a polished 2026 website that feels premium and conversion-ready.");

  return parts.join(" ");
}


/* --------------------------------
   READINESS
-------------------------------- */

function evaluateReadiness(state) {
  const missing = [];

  const whyNow = cleanString(state.answers?.why_now);
  const desiredOutcome = cleanString(state.answers?.desired_outcome);
  const audience = cleanString(state.answers?.target_audience);
  const hasOffer = Array.isArray(state.answers?.offerings) && state.answers.offerings.length > 0;
  const hasCta = cleanString(state.answers?.primary_conversion_goal);
  const diff = Array.isArray(state.answers?.differentiators) ? state.answers.differentiators.length : 0;
  const trust = Array.isArray(state.answers?.trust_signals) ? state.answers.trust_signals.length : 0;
  const cred = Array.isArray(state.answers?.credibility_factors) ? state.answers.credibility_factors.length : 0;
  const hasTrustOrDiff = diff + trust + cred > 0;

  if (!whyNow && !desiredOutcome) missing.push("business_purpose_or_desired_outcome");
  if (!audience) missing.push("target_audience");

  const scoreParts = [
    Boolean(whyNow || desiredOutcome),
    Boolean(audience),
    Boolean(hasOffer),
    Boolean(hasCta),
    Boolean(hasTrustOrDiff)
  ];

  const score = scoreParts.filter(Boolean).length / scoreParts.length;

  return {
    score,
    required_domains_complete: missing.length === 0,
    missing_domains: missing,
    can_generate_now: Boolean(whyNow || desiredOutcome)
  };
}


/* --------------------------------
   UTILITIES
-------------------------------- */

async function readJson(req) {
  try {
    return await req.json();
  } catch {
    return {};
  }
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json",
      "cache-control": "no-store"
    }
  });
}

function cleanString(v) {
  return typeof v === "string" ? v.trim() : "";
}

function isObject(v) {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

function cleanList(arr) {
  if (!Array.isArray(arr)) return [];
  return arr.map(function(v) {
    return cleanString(v);
  }).filter(Boolean);
}

function stripTrailingPeriod(text) {
  return cleanString(text).replace(/[.]+$/g, "");
}

function joinSentence(items) {
  if (!items.length) return "";
  if (items.length === 1) return items[0];
  if (items.length === 2) return items[0] + " and " + items[1];
  return items.slice(0, -1).join(", ") + ", and " + items[items.length - 1];
}