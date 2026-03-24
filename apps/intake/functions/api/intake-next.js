/**
 * SITEFORGE FACTORY: intake-next.js
 * Role: The Strategic Architect (Manifest Aligned)
 * Mission: Refine strategy, harvest facts, and ghostwrite strategic components.
 */

import { INTAKE_CONTROLLER_SYSTEM_PROMPT } from "./intake-prompts.js";

export async function onRequestPost(context) {
  const { request, env } = context;
  const requestId = crypto.randomUUID();

  try {
    const rawBody = await request.text();
    let body;
    try {
      body = JSON.parse(rawBody);
    } catch (e) {
      return new Response(JSON.stringify({ ok: false, error: "Invalid JSON" }), { status: 400 });
    }

    let state = body.state || {};
    const userMessage = (body.answer || "").trim();
    const slug = state.slug;

    if (!slug) {
      return new Response(JSON.stringify({ ok: false, error: "Missing slug in state" }), { status: 400 });
    }

    // 1. EXTRACT CONTEXT FROM MANIFEST SOURCE OF TRUTH
    const strategy = state.provenance?.strategy_contract || {};
    const recommendedSections = strategy.site_structure?.recommended_sections || [];

    // 2. CALL OPENAI (The Architect Brain)
    const aiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${env.OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [
          { role: "system", content: INTAKE_CONTROLLER_SYSTEM_PROMPT },
          { 
            role: "user", 
            content: `
              USER MESSAGE: "${userMessage}"
              
              STRATEGY CONTRACT REQUIREMENTS: ${JSON.stringify(recommendedSections)}
              CURRENT SCHEMA: ${JSON.stringify(state.answers)}
              CURRENT GHOSTWRITING: ${JSON.stringify(state.ghostwritten)}
              
              ACTION:
              1. If the Strategy requires 'FAQ' or 'Process', you MUST draft them now in 'ghostwritten_updates'.
              2. Extract facts to 'updates'.
              3. Propose the next strategic component for verification.
            ` 
          }
        ],
        response_format: { type: "json_object" }
      })
    });

    const aiData = await aiRes.json();
    if (!aiRes.ok) throw new Error(aiData.error?.message || "Architect Failed");

    const prediction = JSON.parse(aiData.choices[0].message.content);

    // 3. APPLY UPDATES (Facts and Ghostwritten Content)
    if (prediction.updates) {
      state.answers = { ...state.answers, ...prediction.updates };
    }

    if (prediction.ghostwritten_updates) {
      state.ghostwritten = { ...state.ghostwritten, ...prediction.ghostwritten_updates };
    }

    // 4. LOG CONVERSATION
    if (!state.conversation) state.conversation = [];
    state.conversation.push({ role: "user", content: userMessage });
    state.conversation.push({ role: "assistant", content: prediction.response });

    // 5. MANIFEST-STRICT READINESS CHECK
    state.readiness = evaluateReadiness(state);

    // 6. SYNC TO GAS
    if (env.ORCHESTRATOR_SCRIPT_URL) {
      await fetch(env.ORCHESTRATOR_SCRIPT_URL + "?route=intake_update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, state, updated_at: new Date().toISOString() })
      });
    }

    return new Response(JSON.stringify({
      ok: true,
      message: prediction.response,
      state: state,
      action: state.readiness.can_generate_now ? "complete" : "continue"
    }), { headers: { "Content-Type": "application/json", "X-Request-ID": requestId } });

  } catch (err) {
    return new Response(JSON.stringify({ ok: false, error: err.message }), { status: 500 });
  }
}

/**
 * STRATEGY-AWARE READINESS GATE
 * Ensures components required by the strategy_contract are present.
 */
function evaluateReadiness(state) {
  const answers = state.answers || {};
  const ghost = state.ghostwritten || {};
  const strategy = state.provenance?.strategy_contract || {};
  const recommended = strategy.site_structure?.recommended_sections || [];
  
  const missing = [];

  // Core Data Requirements
  if (!answers.primary_offer) missing.push("primary_offer");
  if (!answers.service_area) missing.push("service_area");
  if (!answers.phone && !answers.booking_url) missing.push("contact_path");

  // Strategic Component Requirements (Ghostwriting Check)
  if (recommended.includes("FAQ") && (!ghost.faq_items || ghost.faq_items.length < 2)) {
    missing.push("faq_content");
  }
  if (recommended.includes("Process") && (!ghost.process_steps || ghost.process_steps.length < 3)) {
    missing.push("process_content");
  }

  const score = Math.max(0.1, (5 - missing.length) / 5);

  return {
    score: score,
    can_generate_now: missing.length === 0,
    missing_domains: missing
  };
}