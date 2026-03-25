/**
 * SITEFORGE FACTORY: intake-next.js (THE ENFORCER)
 */
import { INTAKE_CONTROLLER_SYSTEM_PROMPT } from "./intake-prompts.js";

export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    const body = await request.json();
    let state = body.state || {};
    const userMessage = (body.answer || "").trim();

    // 1. AI Extraction (Keep for ghostwriting)
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

    // 2. HARD-CODED RECONCILIATION (Bypassing the "Verify Now" Trap)
    state.answers = { ...state.answers, ...prediction.updates };
    state.ghostwritten = { ...state.ghostwritten, ...prediction.ghostwritten_updates };

    // Force the "No Office" state if found in message
    if (userMessage.toLowerCase().includes("no physical office") || userMessage.toLowerCase().includes("dont have a physical office")) {
      state.answers.address = "false";
      state.answers.hours = "false";
      state.answers.hours_of_operation = "false";
    }
    
    // Force "No Booking"
    if (userMessage.toLowerCase().includes("no booking link")) {
      state.answers.booking_url = "false";
    }

    // 3. THE WIN CONDITION (Manual Override)
    // If we have a phone and an offering, we are ready. Period.
    const hasPhone = !!(state.answers.phone || state.answers.public_business_phone_number);
    const hasOffer = !!(state.answers.primary_offer || state.answers.offerings);

    if (hasPhone && hasOffer) {
      state.readiness = { score: 1, can_generate_now: true, missing_domains: [] };
      state.phase = "intake_complete";
      state.verification = { queue_complete: true, verified_at: new Date().toISOString() };
    } else {
      state.readiness = { score: 0.5, can_generate_now: false, missing_domains: ["phone"] };
    }

    // 4. Sync and Return
    if (env.ORCHESTRATOR_SCRIPT_URL) {
      await fetch(env.ORCHESTRATOR_SCRIPT_URL + "?route=intake_update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: state.slug, state })
      });
    }

    return new Response(JSON.stringify({ ok: true, state, action: state.phase === "intake_complete" ? "complete" : "continue" }));
  } catch (err) {
    return new Response(JSON.stringify({ ok: false, error: err.message }), { status: 500 });
  }
}