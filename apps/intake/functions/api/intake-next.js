/**
 * SITEFORGE FACTORY: intake-next.js (TOTAL RECONCILIATION)
 */
import { INTAKE_CONTROLLER_SYSTEM_PROMPT } from "./intake-prompts.js";

export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    const rawBody = await request.text();
    let body = JSON.parse(rawBody);
    let state = body.state || {};
    const userMessage = (body.answer || "").trim();
    const slug = state.slug || state.provenance?.strategy_contract?.business_context?.slug;

    // 1. AI Extraction
    const aiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Authorization": `Bearer ${env.OPENAI_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [
          { role: "system", content: INTAKE_CONTROLLER_SYSTEM_PROMPT },
          { role: "user", content: `USER: ${userMessage}\n\nREQUIRED: If no office/booking, set "address": "false" and "booking_url": "false".` }
        ],
        response_format: { type: "json_object" }
      })
    });

    const aiData = await aiRes.json();
    const prediction = JSON.parse(aiData.choices[0].message.content);

    // 2. Update State
    state.answers = { ...state.answers, ...prediction.updates };
    state.ghostwritten = { ...state.ghostwritten, ...prediction.ghostwritten_updates };

    // 3. THE GLOBAL PRUNER (Cleaning all lists)
    const msgLower = userMessage.toLowerCase();
    const noAddr = state.answers.address === "false" || msgLower.includes("no office") || msgLower.includes("no physical");
    const noBook = state.answers.booking_url === "false" || msgLower.includes("no booking");

    if (noAddr) state.answers.address = "false";
    if (noBook) state.answers.booking_url = "false";

    const contract = state.provenance?.strategy_contract?.content_requirements;
    if (contract) {
      // List of all requirement arrays to clean
      const listsToClean = ['must_verify_now', 'preview_required_fields', 'publish_required_fields'];
      
      listsToClean.forEach(listName => {
        if (Array.isArray(contract[listName])) {
          contract[listName] = contract[listName].filter(f => {
            const check = String(f).toLowerCase();
            if (noAddr && (check.includes('address') || check.includes('hours'))) return false;
            if (noBook && check.includes('booking')) return false;
            if (state.answers.phone && check.includes('phone')) return false;
            if (check.includes('description') || check.includes('photo')) return false;
            return true;
          });
        }
      });
    }

    // 4. Auditor
    const audit = (function(s) {
      const ans = s.answers || {};
      const requirements = s.provenance?.strategy_contract?.content_requirements || {};
      
      // Combine all remaining requirements into one master list for the score
      const masterReqs = [...new Set([
        ...(requirements.must_verify_now || []),
        ...(requirements.publish_required_fields || [])
      ])];

      if (ans.primary_offer && !ans.offerings) ans.offerings = [ans.primary_offer];
      
      const missing = masterReqs.filter(f => !ans[f] || ans[f] === "TBD" || ans[f] === "false");
      const hasOfferings = Array.isArray(ans.offerings) && ans.offerings.length > 0;
      if (!hasOfferings) missing.push("offerings");

      const denom = masterReqs.length + (hasOfferings ? 0 : 1);
      const score = denom === 0 ? 1 : (denom - missing.length) / denom;

      return { score: Math.min(score, 1), can_generate_now: missing.length === 0, missing_domains: missing };
    })(state);

    state.readiness = audit;
    if (audit.can_generate_now) {
      state.phase = "intake_complete";
      state.verification = { queue_complete: true, verified_at: new Date().toISOString() };
    }

    return new Response(JSON.stringify({ ok: true, state: state, action: state.phase === "intake_complete" ? "complete" : "continue" }), {
      headers: { "Content-Type": "application/json" }
    });

  } catch (err) {
    return new Response(JSON.stringify({ ok: false, error: err.message }), { status: 500 });
  }
}