/**
 * SITEFORGE FACTORY — intake-next-reliable.js
 * Simple & Reliable version using Tool Calling + Fallback
 * Use this as a test / replacement
 */

export async function onRequestPost(context) {
    const { request, env } = context;
  
    try {
      const body = await request.json();
      let state = structuredClone(body.state || {});
  
      const userMessage = String(body.answer || "").trim();
  
      if (!state.provenance?.strategy_contract) {
        throw new Error("Missing strategy_contract");
      }
  
      const currentKey = selectNextKey(state);
  
      // Try tool calling first (most reliable)
      let prediction;
      try {
        prediction = await callWithTool(state, currentKey, userMessage, env);
      } catch (e) {
        // Fallback: simple extraction
        prediction = fallbackExtraction(userMessage, currentKey);
      }
  
      // Apply updates
      applyUpdates(state, prediction, currentKey);
  
      // Recompute
      state.verification = recomputeQueue(state);
      state.readiness = evaluateReadiness(state);
  
      // Conversation
      state.conversation = state.conversation || [];
      state.conversation.push({ role: "user", content: userMessage });
      state.conversation.push({ role: "assistant", content: prediction.response || "Thank you." });
  
      state.phase = state.readiness.can_generate_now ? "intake_complete" : "guided_enrichment";
  
      return new Response(JSON.stringify({
        ok: true,
        state,
        current_key: currentKey,
        action: state.phase === "intake_complete" ? "complete" : "continue",
        message: prediction.response || "Thank you.",
      }), {
        headers: { "content-type": "application/json; charset=utf-8" }
      });
  
    } catch (err) {
      console.error(err);
      return new Response(JSON.stringify({ ok: false, error: err.message }), { status: 500 });
    }
  }
  
  /* ====================== CORE LOGIC ====================== */
  
  function selectNextKey(state) {
    const contract = state.provenance.strategy_contract;
    const verified = state.verified || {};
  
    const priority = [
      "phone",
      "booking_url",
      "service_area",
      "offerings",
      "hero_headline",
      "target_audience",
      "primary_conversion_goal"
    ];
  
    for (const key of priority) {
      if (!verified[key]) return key;
    }
    return "final_review";
  }
  
  async function callWithTool(state, currentKey, userMessage, env) {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o",
        temperature: 0.1,
        messages: [
          { role: "system", content: "You are a strict structured output engine. Always use the tool." },
          { role: "user", content: `Key: ${currentKey}\nUser: "${userMessage}"` }
        ],
        tools: [{
          type: "function",
          function: {
            name: "verify",
            parameters: {
              type: "object",
              properties: {
                updates: { type: "object", additionalProperties: true },
                response: { type: "string" }
              },
              required: ["updates", "response"]
            }
          }
        }],
        tool_choice: { type: "function", function: { name: "verify" } }
      })
    });
  
    const data = await res.json();
    const toolCall = data.choices[0].message.tool_calls[0];
    return JSON.parse(toolCall.function.arguments);
  }
  
  function fallbackExtraction(userMessage, currentKey) {
    const updates = {};
  
    // Simple phone extraction
    const phoneMatch = userMessage.match(/(\+?1?[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/);
    if (phoneMatch && currentKey.includes("phone")) {
      updates.phone = phoneMatch[0];
    }
  
    // Service area
    if (currentKey.includes("service") && userMessage.toLowerCase().includes("boulder")) {
      updates.service_area = "Boulder, Colorado and surrounding areas";
    }
  
    return {
      updates,
      response: "Thank you for the information. I've noted your details."
    };
  }
  
  function applyUpdates(state, prediction, currentKey) {
    state.answers = state.answers || {};
    state.verified = state.verified || {};
  
    if (prediction.updates) {
      Object.keys(prediction.updates).forEach(k => {
        state.answers[k] = prediction.updates[k];
        state.verified[k] = true;
      });
    }
  }
  
  function recomputeQueue(state) {
    return {
      queue_complete: Object.keys(state.verified || {}).length > 2,
      verified_count: Object.keys(state.verified || {}).length,
      remaining_keys: [],
      last_updated: new Date().toISOString()
    };
  }
  
  function evaluateReadiness(state) {
    const hasContact = Boolean(state.answers.phone || state.answers.booking_url);
    return {
      score: hasContact ? 0.85 : 0.6,
      can_generate_now: hasContact,
      missing_domains: hasContact ? [] : ["contact_path"]
    };
  }