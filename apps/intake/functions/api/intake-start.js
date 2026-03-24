/**
 * SITEFORGE FACTORY: intake-start.js
 * Role: Initializes the Paid Intake session by injecting Preflight Recon.
 * Logic: Seeds 'strategy_contract' so intake-next can act as an Architect.
 */

import { INTAKE_CONTROLLER_SYSTEM_PROMPT } from "./intake-prompts.js";

export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const body = await request.json();
    const slug = String(body.slug || "").trim();

    if (!slug) {
      return new Response(JSON.stringify({ ok: false, error: "Missing slug" }), { status: 400 });
    }

    // 1. FETCH SOURCE OF TRUTH (Preflight Recon)
    const url = new URL(request.url);
    const reconReq = new Request(`${url.origin}/api/preflight-status`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ slug })
    });
    
    const reconRes = await fetch(reconReq);
    const reconData = await reconRes.json();

    if (!reconRes.ok || !reconData.ok) {
      throw new Error(`Preflight data not found for slug: ${slug}.`);
    }

    // 2. INITIALIZE STATE
    const strategy = reconData.strategy_contract || {};
    const initialState = {
      slug: slug,
      businessName: reconData.input_business_name || strategy.business_context?.business_name || "New Partner",
      clientEmail: reconData.client_email || "",
      phase: "recon_validation",
      answers: {
        primary_offer: strategy.source_snapshot?.primary_offer_hint || "",
        service_area: strategy.business_context?.service_area?.[0] || ""
      },
      ghostwritten: {},
      conversation: [],
      provenance: {
        strategy_contract: strategy,
        recon_snapshot: reconData
      },
      readiness: { score: 0.1, can_generate_now: false, missing_domains: ["contact_path"] }
    };

    // 3. CALL OPENAI (Standard Fetch - No Cloudflare AI Binding Needed)
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
            content: `Initialize intake for ${initialState.businessName}. Propose the strategy from the contract.` 
          }
        ],
        response_format: { type: "json_object" }
      })
    });

    const aiData = await aiRes.json();
    if (!aiRes.ok) throw new Error(aiData.error?.message || "OpenAI Call Failed");

    const prediction = JSON.parse(aiData.choices[0].message.content);

    // 4. UPDATE STATE & SYNC
    initialState.conversation.push({ role: "assistant", content: prediction.response });
    await syncToOrchestrator(slug, initialState, env);

    return new Response(JSON.stringify({
      ok: true,
      message: prediction.response,
      state: initialState
    }), { headers: { "Content-Type": "application/json" } });

  } catch (err) {
    return new Response(JSON.stringify({ ok: false, error: err.message }), { status: 500 });
  }
}

async function syncToOrchestrator(slug, state, env) {
  if (!env.ORCHESTRATOR_SCRIPT_URL) return;
  try {
    await fetch(env.ORCHESTRATOR_SCRIPT_URL + "?route=intake_start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug, state, timestamp: new Date().toISOString() })
    });
  } catch (e) { console.warn("GAS Sync Failed", e.message); }
}