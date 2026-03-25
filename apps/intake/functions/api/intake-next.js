/**
 * SITEFORGE FACTORY: intake-next.js (HARDENED RECONCILIATION)
 * Role: The Strategic Architect & State Machine Refiner
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
      return new Response(JSON.stringify({ ok: false, error: "Invalid JSON body" }), { status: 400 });
    }

    // 1. Context Extraction
    let state = body.state || {};
    const userMessage = (body.answer || "").trim();
    const slug = state.slug || (state.provenance?.strategy_contract?.business_context?.slug);

    if (!slug) {
      return new Response(JSON.stringify({ ok: false, error: "Missing slug in state" }), { status: 400 });
    }

    const strategy = state.provenance?.strategy_contract || {};
    const recommendedSections = strategy.site_structure?.recommended_sections || [];

    // 2. Call OpenAI
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
              STRATEGY REQUIREMENTS: ${JSON.stringify(recommendedSections)}
              CURRENT ANSWERS: ${JSON.stringify(state.answers || {})}
              
              ACTION: Extract facts to 'updates'. Draft 'ghostwritten_updates'.
              If the user confirmed they have NO address or booking link, set those to 'false' in updates.
            ` 
          }
        ],
        response_format: { type: "json_object" }
      })
    });

    const aiData = await aiRes.json();
    if (!aiRes.ok) throw new Error(aiData.error?.message || "OpenAI Architect Failed");
    
    const prediction = JSON.parse(aiData.choices[0].message.content);

    // 3. State Mutation & Reconciliation
    if (!state.answers) state.answers = {};
    if (!state.ghostwritten) state.ghostwritten = {};

    if (prediction.updates) {
      state.answers = { ...state.answers, ...prediction.updates };
    }
    if (prediction.ghostwritten_updates) {
      state.ghostwritten = { ...state.ghostwritten, ...prediction.ghostwritten_updates };
    }

    // A. Fix Offerings Array
    if (state.answers.primary_offer && !Array.isArray(state.answers.offerings)) {
      state.answers.offerings = [state.answers.primary_offer];
    }

    // B. Prune Strategy Contract based on Answers
    const noAddress = state.answers.address === "false" || state.answers.address === false;
    const noBooking = state.answers.booking_url === "false" || state.answers.booking_url === false;

    if (noAddress || noBooking) {
      if (state.provenance?.strategy_contract?.content_requirements?.publish_required_fields) {
        let fields = state.provenance.strategy_contract.content_requirements.publish_required_fields;
        state.provenance.strategy_contract.content_requirements.publish_required_fields = fields.filter(f => {
          if (noAddress && (f === 'address' || f === 'business address')) return false;
          if (noBooking && f === 'booking_url') return false;
          return true;
        });
      }
      // Sync toggles
      if (noAddress) state.provenance.strategy_contract.schema_toggles.show_service_area = true; // Still show area, just not address
    }

    // 4. Update Conversation Logs
    if (!state.conversation) state.conversation = [];
    state.conversation.push({ role: "user", content: userMessage });
    state.conversation.push({ role: "assistant", content: prediction.response || "Details updated." });

    // 5. Readiness & Verification Logic
    // We define this locally to ensure no reference errors
    const audit = (function(s) {
      const ans = s.answers || {};
      const reqFields = s.provenance?.strategy_contract?.content_requirements?.publish_required_fields || ["phone"];
      const missing = reqFields.filter(f => !ans[f] || ans[f] === "TBD" || ans[f] === "");
      
      // Specifically check offerings array for the auditor
      if (!Array.isArray(ans.offerings) || ans.offerings.length === 0) missing.push("offerings_array");

      return {
        score: (reqFields.length + 1 - missing.length) / (reqFields.length + 1),
        can_generate_now: missing.length === 0,
        missing_domains: missing
      };
    })(state);

    state.readiness = audit;
    state.slug = slug; // FORCED PERSISTENCE

    if (audit.can_generate_now) {
      state.verification = {
        queue_complete: true,
        verified_at: new Date().toISOString()
      };
      state.phase = "intake_complete";
    } else {
      state.verification = { queue_complete: false };
    }

    // 6. Final Sync
    if (env.ORCHESTRATOR_SCRIPT_URL) {
      await fetch(env.ORCHESTRATOR_SCRIPT_URL + "?route=intake_update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, state, updated_at: new Date().toISOString() })
      });
    }

    return new Response(JSON.stringify({
      ok: true,
      message: prediction.response || "Strategic state updated.",
      state: state,
      action: state.verification.queue_complete ? "complete" : "continue"
    }), { headers: { "Content-Type": "application/json", "X-Request-ID": requestId } });

  } catch (err) {
    return new Response(JSON.stringify({ 
      ok: false, 
      error: err.message, 
      stack: err.stack 
    }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
}