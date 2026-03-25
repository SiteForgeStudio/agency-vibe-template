/**
 * SITEFORGE FACTORY — intake-next.js
 * Manifest-Compliant Verification & Refinement Engine (Final V5)
 *
 * This is the disciplined version the manifest asked for.
 */

import { INTAKE_VERIFICATION_SYSTEM_PROMPT } from "./intake-prompts.js";

export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const body = await request.json();
    let state = structuredClone(body.state || {});

    const userMessage = String(body.answer || "").trim();

    if (!state.provenance?.strategy_contract) {
      throw new Error("Missing strategy_contract - run intake-start first");
    }

    // 1. Select ONE focused key
    const currentKey = selectNextVerificationKey(state);

    // 2. Get AI response
    const aiResponse = await callVerificationAI(state, currentKey, userMessage, env);

    // 3. Scoped mutation only
    applyScopedUpdates(state, aiResponse, currentKey);

    // 4. Recompute
    state.verification = recomputeVerificationQueue(state);
    state.readiness = evaluateReadiness(state);

    // 5. Conversation
    state.conversation = state.conversation || [];
    state.conversation.push({ role: "user", content: userMessage });
    state.conversation.push({ role: "assistant", content: aiResponse.response });

    state.phase = state.readiness.can_generate_now ? "intake_complete" : "guided_enrichment";

    return new Response(
      JSON.stringify({
        ok: true,
        state,
        current_key: currentKey,
        action: state.phase === "intake_complete" ? "complete" : "continue",
        message: aiResponse.response,
      }),
      { headers: { "content-type": "application/json; charset=utf-8" } }
    );

  } catch (err) {
    console.error("[intake-next]", err);
    return new Response(
      JSON.stringify({ ok: false, error: err.message }),
      { status: 500, headers: { "content-type": "application/json" } }
    );
  }
}

/* ====================== HELPERS ====================== */

function selectNextVerificationKey(state) {
  const contract = state.provenance.strategy_contract;
  const verified = state.verified || {};

  const priority = [
    ...cleanList(contract.content_requirements?.must_verify_now || []),
    "phone",
    "booking_url",
    "hero_headline",
    "visual_direction",
    "offerings",
    "target_audience",
    "service_area",
    "primary_conversion_goal"
  ];

  for (const key of priority) {
    const norm = normalizeKey(key);
    if (!verified[norm]) return norm;
  }
  return "final_review";
}

async function callVerificationAI(state, currentKey, userMessage, env) {
  const contract = state.provenance.strategy_contract;

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o",
      temperature: 0.25,
      messages: [
        { role: "system", content: INTAKE_VERIFICATION_SYSTEM_PROMPT },
        {
          role: "user",
          content: `Business: ${state.businessName || "the business"}
Current key to verify: ${currentKey}

Key context from strategy:
- Archetype: ${contract.business_context?.strategic_archetype}
- Primary goal: ${contract.conversion_strategy?.primary_conversion}
- Must verify: ${JSON.stringify(contract.content_requirements?.must_verify_now || [])}

User's answer: "${userMessage}"

Return only valid JSON with analysis, updates, ghostwritten_updates, and response.`
        }
      ],
      response_format: { type: "json_object" }
    })
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message || "AI call failed");

  return JSON.parse(data.choices[0].message.content);
}

function applyScopedUpdates(state, prediction, currentKey) {
  state.answers = state.answers || {};
  state.ghostwritten = state.ghostwritten || {};
  state.verified = state.verified || {};

  if (prediction.updates) {
    Object.keys(prediction.updates).forEach(k => {
      if (isRelatedToKey(k, currentKey)) {
        state.answers[k] = prediction.updates[k];
        state.verified[normalizeKey(k)] = true;
      }
    });
  }

  if (prediction.ghostwritten_updates) {
    Object.assign(state.ghostwritten, prediction.ghostwritten_updates);
  }
}

function isRelatedToKey(field, key) {
  const map = {
    phone: ["phone"],
    booking_url: ["booking"],
    service_area: ["service", "area"],
    offerings: ["offer"],
    hero_headline: ["hero"],
    visual_direction: ["visual"]
  };
  const related = map[key] || [key];
  return related.some(r => field.toLowerCase().includes(r.toLowerCase()));
}

function recomputeVerificationQueue(state) {
  const contract = state.provenance.strategy_contract;
  const verified = state.verified || {};
  const mustVerify = cleanList(contract.content_requirements?.must_verify_now || []);

  const remaining = mustVerify.filter(k => !verified[normalizeKey(k)]);

  return {
    queue_complete: remaining.length === 0,
    verified_count: Object.keys(verified).length,
    remaining_keys: remaining,
    last_updated: new Date().toISOString()
  };
}

function evaluateReadiness(state) {
  const answers = state.answers || {};
  const verification = state.verification || {};

  const hasContactPath = Boolean(
    cleanString(answers.phone) ||
    cleanString(answers.booking_url) ||
    cleanString(state.clientEmail)
  );

  const missing = [];
  if (!cleanString(answers.target_audience)) missing.push("target_audience");
  if (!Array.isArray(answers.offerings) || answers.offerings.length === 0) missing.push("primary_offer");
  if (!cleanString(answers.primary_conversion_goal)) missing.push("cta_direction");
  if (!hasContactPath) missing.push("contact_path");

  return {
    score: verification.queue_complete && missing.length === 0 ? 1.0 : 0.7,
    can_generate_now: verification.queue_complete === true && missing.length === 0,
    missing_domains: missing
  };
}

/* Utils */
function normalizeKey(key) {
  return String(key || "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

function cleanString(v) {
  return typeof v === "string" ? v.trim() : "";
}

function cleanList(arr) {
  if (!Array.isArray(arr)) return [];
  return arr.map(v => String(v || "").trim()).filter(Boolean);
}