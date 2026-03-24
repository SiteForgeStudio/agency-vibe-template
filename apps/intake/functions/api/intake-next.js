/**
 * SITEFORGE FACTORY: intake-next.js
 * Role: The Strategic Architect.
 * Mission: Refine the site strategy and harvest schema data via consultation.
 * Logic: Uses Preflight Recon (provenance) to propose solutions.
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

    // 1. EXTRACT ARCHITECT CONTEXT
    const strategy = state.provenance?.strategy_contract || {};
    const businessName = state.businessName || "the business";

    // 2. CALL OPENAI (The Strategic Brain)
    // We pass the current state so the AI can "Harvest" facts into the schema.
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
              
              CURRENT SCHEMA (ANSWERS): ${JSON.stringify(state.answers)}
              STRATEGY CONTRACT: ${JSON.stringify(strategy)}
              
              ACTION:
              1. Extract any specific facts (phone, services, area) into 'updates'.
              2. Propose copy refinements in 'ghostwritten_updates'.
              3. Respond as a senior digital strategist.
            ` 
          }
        ],
        response_format: { type: "json_object" }
      })
    });

    const aiData = await aiRes.json();
    if (!aiRes.ok) throw new Error(aiData.error?.message || "Architect Brain Failed");

    const prediction = JSON.parse(aiData.choices[0].message.content);

    // 3. APPLY HARVESTED UPDATES
    // If the user mentioned a phone number, it goes into 'answers'
    if (prediction.updates) {
      state.answers = { ...state.answers, ...prediction.updates };
    }

    // If the AI drafted better headlines/copy based on the chat, it goes here
    if (prediction.ghostwritten_updates) {
      state.ghostwritten = { ...state.ghostwritten, ...prediction.ghostwritten_updates };
    }

    // 4. UPDATE CONVERSATION LOG
    if (!state.conversation) state.conversation = [];
    state.conversation.push({ role: "user", content: userMessage });
    state.conversation.push({ role: "assistant", content: prediction.response });

    // 5. EVALUATE READINESS (Downstream Safety)
    state.readiness = evaluateReadiness(state);

    // 6. SYNC TO ORCHESTRATOR (Google Apps Script)
    if (env.ORCHESTRATOR_SCRIPT_URL) {
      await fetch(env.ORCHESTRATOR_SCRIPT_URL + "?route=intake_update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug: slug,
          state: state,
          updated_at: new Date().toISOString()
        })
      });
    }

    // 7. RESPOND
    return new Response(JSON.stringify({
      ok: true,
      message: prediction.response,
      state: state,
      action: state.readiness.can_generate_now ? "complete" : "continue"
    }), { 
      headers: { 
        "Content-Type": "application/json",
        "X-Request-ID": requestId
      } 
    });

  } catch (err) {
    console.error("Intake-Next Error:", err);
    return new Response(JSON.stringify({ ok: false, error: err.message }), { status: 500 });
  }
}

/**
 * READINESS GATEKEEPER
 */
function evaluateReadiness(state) {
  const answers = state.answers || {};
  const required = ["primary_offer", "service_area", "target_audience"];
  const missing = required.filter(key => !answers[key] || answers[key] === "");
  
  // Need at least one contact method
  if (!answers.phone && !answers.booking_url && !answers.contact_email) {
    missing.push("contact_path");
  }

  const score = Math.max(0.1, (required.length + 1 - missing.length) / (required.length + 1));

  return {
    score: parseFloat(score.toFixed(2)),
    can_generate_now: missing.length === 0,
    missing_domains: missing
  };
}