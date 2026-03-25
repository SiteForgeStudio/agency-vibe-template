/**
 * SITEFORGE FACTORY — intake-next.js
 * Manifest-Compliant Verification & Refinement Engine (V3)
 *
 * This is the core brain of paid intake.
 * It strictly follows the manifest:
 *   • One focused verification key per turn
 *   • Scoped mutations only
 *   • Recomputes queue + readiness after every answer
 *   • Uses the full strategy_contract intelligently
 *   • Respects that some businesses do NOT need phone/address
 *   • Produces expert-strategist tone
 */

import { 
  INTAKE_VERIFICATION_SYSTEM_PROMPT,
  ARCHETYPE_CONFIG 
} from "./intake-prompts.js";

export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const body = await request.json();
    let state = structuredClone(body.state || {});

    const userMessage = String(body.answer || "").trim();

    if (!state.provenance?.strategy_contract) {
      throw new Error("Missing strategy_contract — intake-start must run first");
    }

    // 1. Select the single most important verification key for this turn
    const currentKey = selectNextVerificationKey(state);

    // 2. Call the AI with a focused, context-rich prompt
    const aiResponse = await callVerificationAI(state, currentKey, userMessage, env);

    // 3. Apply ONLY scoped updates (no global mutation)
    applyScopedUpdates(state, aiResponse, currentKey);

    // 4. Recompute verification queue and readiness
    state.verification = recomputeVerificationQueue(state);
    state.readiness = evaluateReadiness(state);

    // 5. Update conversation history
    state.conversation = state.conversation || [];
    state.conversation.push({ role: "user", content: userMessage });
    state.conversation.push({ role: "assistant", content: aiResponse.response });

    // 6. Set phase
    state.phase = state.readiness.can_generate_now ? "intake_complete" : "guided_enrichment";

    return new Response(
      JSON.stringify({
        ok: true,
        state,
        current_key: currentKey,
        action: state.phase === "intake_complete" ? "complete" : "continue",
        message: aiResponse.response,
      }),
      {
        headers: { "content-type": "application/json; charset=utf-8" },
      }
    );

  } catch (err) {
    console.error("[intake-next]", err);
    return new Response(
      JSON.stringify({ ok: false, error: err.message }),
      { status: 500, headers: { "content-type": "application/json" } }
    );
  }
}

/* ====================== CORE HELPERS ====================== */

function selectNextVerificationKey(state) {
  const contract = state.provenance.strategy_contract;
  const answers = state.answers || {};
  const verified = state.verified || {};

  // High-priority keys from strategy + manifest-critical fields
  let priorityList = [
    ...cleanList(contract.content_requirements?.must_verify_now),
    "phone",
    "booking_url",
    "hero_headline",
    "hero_subheadline",
    "visual_direction",
    "offerings",
    "process_notes",
    "target_audience",
    "service_area",
    "primary_conversion_goal",
    "differentiators",
    "trust_signals",
  ];

  // Remove already verified keys
  priorityList = priorityList.filter(key => {
    const norm = normalizeKey(key);
    return !verified[norm] && !isSufficientlyFilled(answers, norm);
  });

  // If nothing critical remains, go to final review
  return priorityList.length > 0 ? normalizeKey(priorityList[0]) : "final_review";
}

async function callVerificationAI(state, currentKey, userMessage, env) {
  const contract = state.provenance.strategy_contract;
  const archetype = contract.business_context?.strategic_archetype || "high_consideration_home_service";

  const systemPrompt = INTAKE_VERIFICATION_SYSTEM_PROMPT;

  const userPrompt = `
Business Name: ${state.businessName || "the business"}
Strategic Archetype: ${archetype}
Primary Conversion Goal: ${contract.conversion_strategy?.primary_conversion || "request_quote"}

Current verification key: ${currentKey}

User's answer: "${userMessage}"

Provide a focused analysis and scoped updates ONLY for this key.
Respect that some businesses do not require a phone or physical address if they use external booking or quote forms.
`;

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
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      response_format: { type: "json_object" },
    }),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message || "OpenAI error");

  return JSON.parse(data.choices[0].message.content);
}

function applyScopedUpdates(state, prediction, currentKey) {
  state.answers = state.answers || {};
  state.ghostwritten = state.ghostwritten || {};
  state.verified = state.verified || {};

  // Only update fields related to the current key
  if (prediction.updates) {
    Object.keys(prediction.updates).forEach(key => {
      if (isRelatedToVerificationKey(key, currentKey)) {
        state.answers[key] = prediction.updates[key];
        state.verified[normalizeKey(key)] = true;
      }
    });
  }

  // Ghostwritten refinements (premium copy)
  if (prediction.ghostwritten_updates) {
    Object.assign(state.ghostwritten, prediction.ghostwritten_updates);
  }
}

function isRelatedToVerificationKey(field, currentKey) {
  const map = {
    hero_headline: ["hero", "headline"],
    hero_subheadline: ["hero", "subtext"],
    visual_direction: ["visual", "image", "gallery"],
    offerings: ["offer", "feature", "service"],
    process_notes: ["process"],
    phone: ["contact"],
    booking_url: ["booking", "contact"],
    target_audience: ["audience"],
  };

  const related = map[currentKey] || [currentKey];
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
    last_updated: new Date().toISOString(),
  };
}

function evaluateReadiness(state) {
  const contract = state.provenance.strategy_contract;
  const answers = state.answers || {};
  const verification = state.verification || {};

  const hasContactPath = Boolean(
    cleanString(answers.phone) ||
    cleanString(answers.booking_url) ||
    cleanString(state.clientEmail) ||
    contract.conversion_strategy?.primary_conversion === "request_quote" // quote-only is valid
  );

  const missing = [];

  if (!cleanString(answers.target_audience)) missing.push("target_audience");
  if (!Array.isArray(answers.offerings) || answers.offerings.length === 0) missing.push("primary_offer");
  if (!cleanString(answers.primary_conversion_goal)) missing.push("cta_direction");
  if (!hasContactPath) missing.push("contact_path");

  const canGenerateNow = verification.queue_complete === true && missing.length === 0;

  return {
    score: canGenerateNow ? 1 : 0.6,
    can_generate_now: canGenerateNow,
    missing_domains: missing,
  };
}

/* ====================== UTILITIES ====================== */

function normalizeKey(key) {
  return String(key || "")
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "");
}

function cleanString(v) {
  return typeof v === "string" ? v.trim() : "";
}

function cleanList(arr) {
  if (!Array.isArray(arr)) return [];
  return arr.map(v => String(v || "").trim()).filter(Boolean);
}

function isSufficientlyFilled(answers, key) {
  const val = answers[key];
  if (!val) return false;
  if (Array.isArray(val)) return val.length > 0;
  return String(val).trim().length > 8;
}