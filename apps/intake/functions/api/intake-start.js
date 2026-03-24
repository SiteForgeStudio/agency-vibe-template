/**
 * SITEFORGE FACTORY: intake-next.js
 * Role: The Strategic Architect.
 * Mission: Refine the site strategy and harvest schema data through consultation.
 * Logic: Uses Preflight Recon (provenance) to propose rather than interrogate.
 */

import { INTAKE_CONTROLLER_SYSTEM_PROMPT } from "./intake-prompts.js";

export async function onRequestPost(context) {
  const { request, env } = context;
  const requestId = crypto.randomUUID();

  try {
    const body = await request.json();
    let state = body.state || {};
    const userMessage = (body.answer || "").trim();
    const slug = state.slug;

    if (!slug) {
      return new Response(JSON.stringify({ ok: false, error: "Missing slug" }), { status: 400 });
    }

    // 1. EXTRACT ARCHITECT CONTEXT
    // We pull the strategy_contract that was seeded by intake-start.js
    const strategy = state.provenance?.strategy_contract || {};
    const businessName = state.businessName || "the business";

    // 2. CALL OPENAI (The Strategic Brain)
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
              
              CURRENT ANSWERS: ${JSON.stringify(state.answers)}
              GHOSTWRITTEN BLOCKS: ${JSON.stringify(state.ghostwritten)}
              STRATEGY CONTRACT: ${JSON.stringify(strategy)}
              
              Analyze the user's input. Harvest any new facts into 'updates'. 
              Refine the 'ghostwritten_updates' if needed. 
              Provide a professional, architectural response.
            ` 
          }
        ],
        response_format: { type: "json_object" }
      })
    });

    const aiData = await aiRes.json();
    if (!aiRes.ok) throw new Error(aiData.error?.message || "Architect Brain Failed");

    const prediction = JSON.parse(aiData.choices[0].message.content);

    // 3. UPDATE STATE WITH HARVESTED DATA
    // We merge harvested facts into the primary answers object for the build
    if (prediction.updates) {
      state.answers = { ...state.answers, ...prediction.updates };
    }

    // We merge copy refinements into the ghostwritten object
    if (prediction.ghostwritten_updates) {
      state.ghostwritten = { ...state.ghostwritten, ...prediction.ghostwritten_updates };
    }

    // 4. UPDATE CONVERSATION HISTORY
    if (!state.conversation) state.conversation = [];
    state.conversation.push({ role: "user", content: userMessage });
    state.conversation.push({ role: "assistant", content: prediction.response });

    // 5. EVALUATE READINESS (Downstream Gate for intake-complete)
    state.readiness = evaluateReadiness(state);

    // 6. SYNC TO ORCHESTRATOR (Google Apps Script)
    // Ensures the spreadsheet stays updated throughout the conversation
    await syncToOrchestrator(slug, state, env);

    // 7. RESPOND TO CLIENT
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
    return new Response(JSON.stringify({ 
      ok: false, 
      error: err.message 
    }), { status: 500 });
  }
}

/**
 * READINESS GATEKEEPER
 * Strictly maps to the Master Schema requirements.
 */
function evaluateReadiness(state) {
  const answers = state.answers || {};
  const required = ["primary_offer", "service_area", "target_audience"];
  const missing = required.filter(key => !answers[key] || answers[key] === "");
  
  // Contact path logic: Need at least one way to reach them
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

/**
 * ORCHESTRATOR SYNC (Google Apps Script)
 */
async function syncToOrchestrator(slug, state, env) {
  if (!env.ORCHESTRATOR_SCRIPT_URL) return;
  
  try {
    await fetch(env.ORCHESTRATOR_SCRIPT_URL + "?route=intake_update", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        slug: slug,
        state: state,
        updated_at: new Date().toISOString()
      })
    });
  } catch (e) {
    console.warn("Orchestrator sync failed:", e.message);
  }
}