/**
 * SITEFORGE FACTORY: intake-next.js (IRONCLAD RECONCILIATION)
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

    // 2. Call OpenAI with Reinforced Instructions
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
              
              CRITICAL ACTION: If the user indicates they do NOT have a physical office/address or do NOT have a booking link, you MUST set "address": "false" and/or "booking_url": "false" in your JSON 'updates'.
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

    // A. Mechanical Fixes (Offerings & Phone)
    if (state.answers.primary_offer && (!state.answers.offerings || !Array.isArray(state.answers.offerings))) {
      state.answers.offerings = [state.answers.primary_offer];
    }

    // B. THE IRONCLAD PRUNER: Check AI flags OR fallback to direct message matching
    const msgLower = userMessage.toLowerCase();
    const noAddr = state.answers.address === "false" || 
                   msgLower.includes("no office") || 
                   msgLower.includes("no physical") || 
                   msgLower.includes("dont have a physical office");
    
    const noBook = state.answers.booking_url === "false" || 
                   msgLower.includes("no booking link") || 
                   msgLower.includes("dont have a booking");

    // Force values in answers so Auditor sees them as "answered"
    if (noAddr) state.answers.address = "false";
    if (noBook) state.answers.booking_url = "false";

    if (state.provenance?.strategy_contract?.content_requirements?.publish_required_fields) {
      let fields = state.provenance.strategy_contract.content_requirements.publish_required_fields;
      
      state.provenance.strategy_contract.content_requirements.publish_required_fields = fields.filter(f => {
        const check = String(f).toLowerCase().trim();
        
        // Remove Address/Hours if Service Area Business
        if (noAddr && (check.includes('address') || check.includes('hours'))) return false;
        
        // Remove Booking
        if (noBook && check.includes('booking')) return false;
        
        // Remove redundant phone requirements
        if (state.answers.phone && (check.includes('phone') || check.includes('number'))) return false;
        
        // Remove boilerplate
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
      
      const missing = reqFields.filter(f => {
         const val = ans[f];
         return !val || val === "TBD" || val === "" || val === "false";
      });
      
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