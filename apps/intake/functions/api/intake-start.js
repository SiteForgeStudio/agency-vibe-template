/**
 * SITEFORGE FACTORY: intake-start.js
 * Role: Bootstraps the Paid Intake session by injecting Preflight Recon.
 * Logic: Strictly follows the Manifest by seeding the 'strategy_contract'.
 */

import { INTAKE_CONTROLLER_SYSTEM_PROMPT } from "./intake-prompts.js";

export async function onRequestPost(context) {
  const { request, env } = context;
  const requestId = crypto.randomUUID();

  try {
    const body = await request.json();
    const slug = String(body.slug || "").trim();

    if (!slug) {
      return new Response(JSON.stringify({ ok: false, error: "Missing slug" }), { status: 400 });
    }

    // 1. FETCH SOURCE OF TRUTH (Preflight Recon)
    // We call the internal status API to get the strategic results of the Recon phase.
    const url = new URL(request.url);
    const reconReq = new Request(`${url.origin}/api/preflight-status`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ slug })
    });
    
    const reconRes = await fetch(reconReq);
    const reconData = await reconRes.json();

    if (!reconRes.ok || !reconData.ok) {
      throw new Error(`Preflight data not found for slug: ${slug}. Ensure Recon is complete.`);
    }

    // 2. INITIALIZE STATE (The "Memory" for the Architect)
    // We map the Preflight results into 'provenance' so intake-next knows the business.
    const strategy = reconData.strategy_contract || {};
    
    const initialState = {
      slug: slug,
      businessName: reconData.input_business_name || strategy.business_context?.business_name || "New Partner",
      clientEmail: reconData.client_email || "",
      phase: "recon_validation",
      answers: {
        // Seed initial answers from recon to prevent "stiff" discovery questions
        primary_offer: strategy.source_snapshot?.primary_offer_hint || "",
        service_area: strategy.business_context?.service_area?.[0] || ""
      },
      ghostwritten: {},
      conversation: [],
      provenance: {
        strategy_contract: strategy,
        recon_snapshot: reconData
      },
      readiness: {
        score: 0.1,
        can_generate_now: false,
        missing_domains: ["contact_path", "target_audience"]
      }
    };

    // 3. GENERATE THE STRATEGIC OPENING
    // We use the Architect Prompt to create a message based on actual business data.
    const aiResponse = await env.AI.run("@cf/meta/llama-3-70b-instruct", {
      messages: [
        { role: "system", content: INTAKE_CONTROLLER_SYSTEM_PROMPT },
        { 
          role: "user", 
          content: `Generate a premium opening message for ${initialState.businessName}. Propose the strategy found in the strategy_contract. Do not ask 'How can I help'; tell them what we've planned.` 
        }
      ],
      response_format: { type: "json_object" }
    });

    const prediction = JSON.parse(aiResponse.response);

    // 4. UPDATE STATE WITH AI'S FIRST PROPOSAL
    initialState.conversation.push({
      role: "assistant",
      content: prediction.response
    });

    // 5. SYNC TO ORCHESTRATOR (Google Apps Script)
    await syncToOrchestrator(slug, initialState, env);

    return new Response(JSON.stringify({
      ok: true,
      message: prediction.response,
      state: initialState,
      analysis: prediction.analysis
    }), { 
      headers: { 
        "Content-Type": "application/json",
        "X-Request-ID": requestId
      } 
    });

  } catch (err) {
    console.error("Intake-Start Error:", err);
    return new Response(JSON.stringify({ 
      ok: false, 
      error: err.message 
    }), { status: 500 });
  }
}

async function syncToOrchestrator(slug, state, env) {
  const scriptUrl = env.ORCHESTRATOR_SCRIPT_URL;
  if (!scriptUrl) return;

  try {
    await fetch(scriptUrl + "?route=intake_start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        slug: slug,
        state: state,
        timestamp: new Date().toISOString()
      })
    });
  } catch (e) {
    console.warn("GAS Orchestrator sync failed:", e.message);
  }
}