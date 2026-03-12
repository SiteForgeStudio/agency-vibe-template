/**
 * intake-strategy.js
 *
 * SiteForge Factory — Final Strategy Inference Pass
 *
 * Purpose:
 * - strengthen structured intake state before generation
 * - infer missing strategy fields
 * - normalize weak intake into a better final brief
 */

export async function runStrategyInferencePass(env, state) {
    const apiKey = env.OPENAI_API_KEY;
    const model = env.OPENAI_MODEL || "gpt-4.1";
  
    if (!apiKey) {
      return state;
    }
  
    const prompt = buildStrategyInferencePrompt(state);
  
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "authorization": "Bearer " + apiKey
      },
      body: JSON.stringify({
        model,
        temperature: 0.3,
        messages: [
          {
            role: "system",
            content: STRATEGY_INFERENCE_SYSTEM_PROMPT
          },
          {
            role: "user",
            content: prompt
          }
        ]
      })
    });
  
    const data = await res.json();
    const content = data?.choices?.[0]?.message?.content;
  
    if (!content) {
      return state;
    }
  
    let parsed;
    try {
      parsed = JSON.parse(content);
    } catch {
      return state;
    }
  
    return mergeStrategyState(state, parsed);
  }
  
  const STRATEGY_INFERENCE_SYSTEM_PROMPT = `
  You are the SiteForge Factory Strategy Inference Engine.
  
  You receive a partially complete intake state for a business website.
  
  Your job is to strengthen the state before website generation.
  
  Goals:
  - infer missing but important strategic fields
  - improve clarity of offers, CTA, trust, tone, and components
  - preserve explicit user input
  - never invent highly specific facts
  - prefer reasonable strategic inference over empty fields
  
  You may update:
  - answers.offerings
  - answers.primary_conversion_goal
  - answers.differentiators
  - answers.trust_signals
  - answers.first_impression_goal
  - answers.visual_direction
  - answers.tone_preferences
  - inference.suggested_vibe
  - inference.suggested_components
  - inference.tone_direction
  - inference.visual_direction
  
  Rules:
  - keep explicit user-provided values when they already exist
  - only fill blanks or weak fields
  - suggested_components should be a practical conversion-focused section list
  - output valid JSON only
  - do not include markdown
  `.trim();
  
  function buildStrategyInferencePrompt(state) {
    return `
  Here is the current intake state as JSON.
  
  Return a JSON object with this exact shape:
  
  {
    "answers": {
      "offerings": [],
      "primary_conversion_goal": "",
      "differentiators": [],
      "trust_signals": [],
      "first_impression_goal": "",
      "visual_direction": "",
      "tone_preferences": ""
    },
    "inference": {
      "suggested_vibe": "",
      "suggested_components": [],
      "tone_direction": "",
      "visual_direction": ""
    }
  }
  
  Only include best-effort strengthened strategy fields.
  
  Current state:
  ${JSON.stringify(state, null, 2)}
  `.trim();
  }
  
  function mergeStrategyState(original, updates) {
    const next = JSON.parse(JSON.stringify(original || {}));
  
    if (!updates || typeof updates !== "object") {
      return next;
    }
  
    if (updates.answers && typeof updates.answers === "object") {
      next.answers = next.answers || {};
  
      if (shouldFillArray(next.answers.offerings, updates.answers.offerings)) {
        next.answers.offerings = cleanArray(updates.answers.offerings);
      }
  
      if (shouldFillString(next.answers.primary_conversion_goal, updates.answers.primary_conversion_goal)) {
        next.answers.primary_conversion_goal = cleanString(updates.answers.primary_conversion_goal);
      }
  
      if (shouldFillArray(next.answers.differentiators, updates.answers.differentiators)) {
        next.answers.differentiators = cleanArray(updates.answers.differentiators);
      }
  
      if (shouldFillArray(next.answers.trust_signals, updates.answers.trust_signals)) {
        next.answers.trust_signals = cleanArray(updates.answers.trust_signals);
      }
  
      if (shouldFillString(next.answers.first_impression_goal, updates.answers.first_impression_goal)) {
        next.answers.first_impression_goal = cleanString(updates.answers.first_impression_goal);
      }
  
      if (shouldFillString(next.answers.visual_direction, updates.answers.visual_direction)) {
        next.answers.visual_direction = cleanString(updates.answers.visual_direction);
      }
  
      if (shouldFillString(next.answers.tone_preferences, updates.answers.tone_preferences)) {
        next.answers.tone_preferences = cleanString(updates.answers.tone_preferences);
      }
    }
  
    if (updates.inference && typeof updates.inference === "object") {
      next.inference = next.inference || {};
  
      if (shouldFillString(next.inference.suggested_vibe, updates.inference.suggested_vibe)) {
        next.inference.suggested_vibe = cleanString(updates.inference.suggested_vibe);
      }
  
      if (shouldFillArray(next.inference.suggested_components, updates.inference.suggested_components)) {
        next.inference.suggested_components = cleanArray(updates.inference.suggested_components);
      }
  
      if (shouldFillString(next.inference.tone_direction, updates.inference.tone_direction)) {
        next.inference.tone_direction = cleanString(updates.inference.tone_direction);
      }
  
      if (shouldFillString(next.inference.visual_direction, updates.inference.visual_direction)) {
        next.inference.visual_direction = cleanString(updates.inference.visual_direction);
      }
    }
  
    return next;
  }
  
  function shouldFillString(existing, incoming) {
    return !cleanString(existing) && !!cleanString(incoming);
  }
  
  function shouldFillArray(existing, incoming) {
    return (!Array.isArray(existing) || existing.length === 0) &&
           Array.isArray(incoming) &&
           incoming.length > 0;
  }
  
  function cleanString(value) {
    return typeof value === "string" ? value.trim() : "";
  }
  
  function cleanArray(value) {
    if (!Array.isArray(value)) return [];
    return value.map(cleanString).filter(Boolean);
  }