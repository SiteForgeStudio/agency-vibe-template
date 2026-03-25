/**
 * SITEFORGE FACTORY: intake-next.js (HARDENED RECONCILIATION - NUCLEAR PRUNER)
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
              If the user confirmed they have NO address or booking link, set those to 'false' (string) in updates.
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

    // A. Fix Offerings Array (Crucial for Auditor)
    if (state.answers.primary_offer && (!state.answers.offerings || !Array.isArray(state.answers.offerings))) {
      state.answers.offerings = [state.answers.primary_offer];
    }

    // B. THE NUCLEAR PRUNER: Case-insensitive, substring-based removal
    const noAddr = String(state.answers.address).toLowerCase() === "false";
    const noBook = String(state.answers.booking_url).toLowerCase() === "false";

    if (state.provenance?.strategy_contract?.content_requirements?.publish_required_fields) {
      let fields = state.provenance.strategy_contract.content_requirements.publish_required_fields;
      
      state.provenance.strategy_contract.content_requirements.publish_required_fields = fields.filter(f => {
        const check = String(f).toLowerCase().trim();
        
        // Remove Address and Hours if user opted out of physical location
        if (noAddr && (check.includes('address') || check.includes('hours'))) return false;
        
        // Remove Booking URL requirements
        if (noBook && check.includes('booking')) return false;
        
        // Remove generic 'phone number' aliases if the 'phone' key is present
        if (state.answers.phone && check.includes('phone')) return false;
        
        // Remove boilerplate that AI handles by default
        if (check.includes('description') || check.includes('photo')) return false;
        
        return true;
      });
    }

    // 4. Update Conversation Logs
    if (!state.conversation) state.conversation = [];
    state.conversation.push({ role: "user", content: userMessage });
    state.conversation.push({ role: "assistant", content: prediction.response || "Details updated." });

    // 5. Readiness & Verification Logic
    const audit = (function(s) {
      const ans = s.answers || {};
      const reqFields = s.provenance?.strategy_contract?.content_requirements?.publish_required_fields || [];
      
      // Filter the pruned list against current state
      const missing = reqFields.filter(f => {
         const val = ans[f];
         return !val || val === "TBD" || val === "" || val === "false";
      });
      
      // Separate check for offerings array
      const hasOfferings = Array.isArray(ans.offerings) && ans.offerings.length > 0;
      if (!hasOfferings) missing.push("offerings");

      const totalReq = reqFields.length + (hasOfferings ? 0 : 1);
      const score = totalReq === 0 ? 1 : (totalReq - missing.length) / totalReq;

      return {
        score: Math.max(0, Math.min(score, 1)),
        can_generate_now: (missing.length === 0 && hasOfferings),
        missing_domains: missing
      };
    })(state);

    state.readiness = audit;
    state.slug = slug; 

    if (audit.can_generate_now) {
      state.verification = {
        queue_complete: true,
        verified_at: new Date().toISOString()
      };
      state.phase = "intake_complete";
    } else {
      state.verification = { queue_complete: false };
    }

    // 6. Final Sync to Orchestrator
    if (env.ORCHESTRATOR_SCRIPT_URL) {
      try {
        await fetch(env.ORCHESTRATOR_SCRIPT_URL + "?route=intake_update", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ slug, state, updated_at: new Date().toISOString() })
        });
      } catch (e) {
        console.error("Orchestrator sync failed", e);
      }
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