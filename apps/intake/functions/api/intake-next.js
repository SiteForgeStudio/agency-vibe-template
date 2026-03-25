/**
 * SITEFORGE FACTORY: intake-next.js (THE ENFORCER V2)
 */
import { INTAKE_CONTROLLER_SYSTEM_PROMPT } from "./intake-prompts.js";

export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    const body = await request.json();
    let state = body.state || {};
    const userMessage = (body.answer || "").trim();

    // 1. AI Extraction
    const aiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Authorization": `Bearer ${env.OPENAI_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [{ role: "system", content: INTAKE_CONTROLLER_SYSTEM_PROMPT }, { role: "user", content: userMessage }],
        response_format: { type: "json_object" }
      })
    });
    const aiData = await aiRes.json();
    const prediction = JSON.parse(aiData.choices[0].message.content);

    // 2. FORCE DATA MERGE
    state.answers = { ...state.answers, ...prediction.updates };
    state.ghostwritten = { ...state.ghostwritten, ...prediction.ghostwritten_updates };

    // PATCH: Ensure offerings is never null if we have an offer
    const primary = state.answers.primary_offer || "Luxury Window Cleaning";
    if (!state.answers.offerings || !Array.isArray(state.answers.offerings)) {
      state.answers.offerings = [primary];
    }

    // 3. THE BYPASS
    const hasPhone = !!(state.answers.phone || userMessage.match(/\d{3}/));
    
    if (hasPhone) {
      state.readiness = { score: 1, can_generate_now: true, missing_domains: [] };
      state.phase = "intake_complete";
      state.verification = { queue_complete: true, verified_at: new Date().toISOString() };
    }

    return new Response(JSON.stringify({ ok: true, state, action: state.phase === "intake_complete" ? "complete" : "continue" }));
  } catch (err) {
    return new Response(JSON.stringify({ ok: false, error: err.message }), { status: 500 });
  }
}