/**
 * SITEFORGE FACTORY: intake-start.js
 * Role: Bootstraps the Paid Intake session.
 * Logic: Seeds 'strategy_contract' so intake-next can act as an Architect.
 */

import { INTAKE_CONTROLLER_SYSTEM_PROMPT } from "./intake-prompts.js";

export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    // Robust Parsing: Ensure we get the body regardless of minor formatting issues
    const rawBody = await request.text();
    let body;
    try {
      body = JSON.parse(rawBody);
    } catch (e) {
      return new Response(JSON.stringify({ ok: false, error: "Invalid JSON payload" }), { status: 400 });
    }

    const slug = body.slug;
    if (!slug) {
      return new Response(JSON.stringify({ ok: false, error: "Missing slug", received: body }), { status: 400 });
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
    // Pulling from the paid_intake_json or strategy_contract as seen in your previous successful curl
    const strategy = reconData.strategy_contract || (reconData.paid_intake_json ? JSON.parse(reconData.paid_intake_json).strategy_contract : {});
    
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

    // 3. CALL OPENAI (The Strategic Brain)
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
            content: `Initialize intake for ${initialState.businessName}. Strategy: ${JSON.stringify(strategy)}` 
          }
        ],
        response_format: { type: "json_object" }
      })
    });

    const aiData = await aiRes.json();
    if (!aiRes.ok) throw new Error(aiData.error?.message || "OpenAI Failed");

    const prediction = JSON.parse(aiData.choices[0].message.content);
    const openingMessage = prediction.response || "Analysis complete. Ready to build your strategy.";

    // 4. UPDATE STATE & SYNC
    initialState.conversation.push({ role: "assistant", content: openingMessage });
    
    if (env.ORCHESTRATOR_SCRIPT_URL) {
      await fetch(env.ORCHESTRATOR_SCRIPT_URL + "?route=intake_start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, state: initialState, timestamp: new Date().toISOString() })
      });
    }

    return new Response(JSON.stringify({
      ok: true,
      message: openingMessage,
      state: initialState
    }), { headers: { "Content-Type": "application/json" } });

  } catch (err) {
    return new Response(JSON.stringify({ ok: false, error: err.message }), { status: 500 });
  }
}