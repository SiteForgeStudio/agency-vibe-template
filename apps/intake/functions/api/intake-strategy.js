/**
 * intake-strategy.js
 *
 * SiteForge Factory — Final Strategy Inference Pass
 *
 * Purpose:
 * - strengthen structured intake state before generation
 * - merge model-provided updates safely
 * - support both nested objects and dotted-path keys
 * - preserve explicit intake values unless empty
 * - avoid leaking literal dotted keys like "answers.target_audience"
 */

export async function runStrategyInferencePass(env, state) {
  const apiKey = env.OPENAI_API_KEY;
  const model = env.OPENAI_MODEL || "gpt-4.1";
  const normalizedState = normalizeState(state);

  if (!apiKey) {
    return normalizedState;
  }

  const prompt = buildStrategyInferencePrompt(normalizedState);

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: "Bearer " + apiKey
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
    return normalizedState;
  }

  let parsed;
  try {
    parsed = JSON.parse(content);
  } catch {
    return normalizedState;
  }

  return mergeStrategyState(normalizedState, parsed);
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

You may return updates either as nested objects or dotted-path keys.

Examples of valid return shapes:

{
  "answers": {
    "primary_conversion_goal": "request a quote"
  },
  "inference": {
    "suggested_vibe": "Trustworthy and modern"
  }
}

or

{
  "answers.primary_conversion_goal": "request a quote",
  "inference.suggested_vibe": "Trustworthy and modern"
}

Rules:
- preserve explicit user-provided values when they already exist
- fill blanks or strengthen weak strategic fields
- return valid JSON only
- do not include markdown
- do not include commentary
`.trim();

function buildStrategyInferencePrompt(state) {
  return `
Here is the current intake state:

${JSON.stringify(state, null, 2)}

Strengthen the state while preserving explicit user-provided facts.

Priorities:
1. preserve explicit user input
2. fill missing strategy fields where reasonable
3. improve inferred tone, vibe, trust, and suggested components
4. do not remove valid contact details, location details, or CTA details

Return only valid JSON.
`.trim();
}

/* --------------------------------
   STRATEGY MERGE
-------------------------------- */

function mergeStrategyState(existingState, inferredPatch) {
  const base = normalizeState(existingState);
  const patch = isObject(inferredPatch) ? inferredPatch : {};
  const next = structuredClone(base);

  Object.keys(patch).forEach(function(key) {
    applyPatchEntry(next, key, patch[key]);
  });

  removeLiteralDottedKeys(next);

  return normalizeState(next);
}

function applyPatchEntry(target, key, value) {
  if (!key) return;

  if (key.includes(".")) {
    setByPath(target, key, value, {
      preserveExisting: shouldPreservePath(key)
    });
    return;
  }

  if (key === "answers" && isObject(value)) {
    Object.keys(value).forEach(function(subKey) {
      setByPath(target, "answers." + subKey, value[subKey], {
        preserveExisting: true
      });
    });
    return;
  }

  if (key === "inference" && isObject(value)) {
    Object.keys(value).forEach(function(subKey) {
      setByPath(target, "inference." + subKey, value[subKey], {
        preserveExisting: false
      });
    });
    return;
  }

  if (key === "ghostwritten" && isObject(value)) {
    Object.keys(value).forEach(function(subKey) {
      setByPath(target, "ghostwritten." + subKey, value[subKey], {
        preserveExisting: false
      });
    });
    return;
  }

  if (isObject(value) && isObject(target[key])) {
    target[key] = {
      ...target[key],
      ...value
    };
    return;
  }

  target[key] = cloneValue(value);
}

function shouldPreservePath(path) {
  return (
    path.startsWith("answers.") ||
    path === "businessName" ||
    path === "clientEmail"
  );
}

function setByPath(target, dottedPath, value, options = {}) {
  const parts = String(dottedPath || "").split(".").filter(Boolean);
  const preserveExisting = Boolean(options.preserveExisting);

  if (!parts.length) return;

  let cursor = target;
  for (let i = 0; i < parts.length - 1; i += 1) {
    const part = parts[i];
    if (!isObject(cursor[part])) {
      cursor[part] = {};
    }
    cursor = cursor[part];
  }

  const finalKey = parts[parts.length - 1];
  const existingValue = cursor[finalKey];

  if (preserveExisting && isMeaningful(existingValue)) {
    return;
  }

  cursor[finalKey] = cloneValue(value);
}

function isMeaningful(value) {
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "string") return cleanString(value).length > 0;
  if (isObject(value)) return Object.keys(value).length > 0;
  return Boolean(value);
}

function removeLiteralDottedKeys(state) {
  Object.keys(state).forEach(function(key) {
    if (key.includes(".")) {
      delete state[key];
    }
  });
}

/* --------------------------------
   STATE NORMALIZATION
-------------------------------- */

function normalizeState(state) {
  const next = structuredClone(isObject(state) ? state : {});

  next.answers = {
    why_now: "",
    desired_outcome: "",
    primary_conversion_goal: "",
    first_impression_goal: "",
    target_audience: "",
    offerings: [],
    booking_method: "",
    phone: "",
    booking_url: "",
    office_address: "",
    differentiators: [],
    trust_signals: [],
    credibility_factors: [],
    location_context: "",
    service_area: "",
    tone_preferences: "",
    visual_direction: "",
    process_notes: [],
    faq_topics: [],
    pricing_context: "",
    ...(isObject(next.answers) ? next.answers : {})
  };

  next.inference = {
    suggested_vibe: "",
    suggested_components: [],
    tone_direction: "",
    visual_direction: "",
    missing_information: [],
    confidence_score: 0,
    ...(isObject(next.inference) ? next.inference : {})
  };

  next.ghostwritten = {
    tagline: "",
    hero_headline: "",
    hero_subheadline: "",
    about_summary: "",
    features_copy: [],
    faqs: [],
    ...(isObject(next.ghostwritten) ? next.ghostwritten : {})
  };

  next.provenance = isObject(next.provenance) ? next.provenance : {};
  next.conversation = Array.isArray(next.conversation) ? next.conversation : [];

  next.session_id = cleanString(next.session_id);
  next.phase = cleanString(next.phase);
  next.businessName = cleanString(next.businessName);
  next.clientEmail = cleanString(next.clientEmail);

  next.answers.why_now = cleanString(next.answers.why_now);
  next.answers.desired_outcome = cleanString(next.answers.desired_outcome);
  next.answers.primary_conversion_goal = cleanString(next.answers.primary_conversion_goal);
  next.answers.first_impression_goal = cleanString(next.answers.first_impression_goal);
  next.answers.target_audience = cleanString(next.answers.target_audience);
  next.answers.booking_method = cleanString(next.answers.booking_method);
  next.answers.phone = cleanString(next.answers.phone);
  next.answers.booking_url = cleanString(next.answers.booking_url);
  next.answers.office_address = cleanString(next.answers.office_address);
  next.answers.location_context = cleanString(next.answers.location_context);
  next.answers.service_area = cleanString(next.answers.service_area);
  next.answers.tone_preferences = cleanString(next.answers.tone_preferences);
  next.answers.visual_direction = cleanString(next.answers.visual_direction);
  next.answers.pricing_context = cleanString(next.answers.pricing_context);

  next.answers.offerings = normalizeStringArray(next.answers.offerings);
  next.answers.differentiators = normalizeStringArray(next.answers.differentiators);
  next.answers.trust_signals = normalizeStringArray(next.answers.trust_signals);
  next.answers.credibility_factors = normalizeStringArray(next.answers.credibility_factors);
  next.answers.process_notes = normalizeStringArray(next.answers.process_notes);
  next.answers.faq_topics = normalizeStringArray(next.answers.faq_topics);

  next.inference.suggested_vibe = cleanString(next.inference.suggested_vibe);
  next.inference.suggested_components = normalizeStringArray(next.inference.suggested_components);
  next.inference.tone_direction = cleanString(next.inference.tone_direction);
  next.inference.visual_direction = cleanString(next.inference.visual_direction);
  next.inference.missing_information = normalizeStringArray(next.inference.missing_information);
  next.inference.confidence_score =
    typeof next.inference.confidence_score === "number"
      ? next.inference.confidence_score
      : 0;

  next.ghostwritten.tagline = cleanString(next.ghostwritten.tagline);
  next.ghostwritten.hero_headline = cleanString(next.ghostwritten.hero_headline);
  next.ghostwritten.hero_subheadline = cleanString(next.ghostwritten.hero_subheadline);
  next.ghostwritten.about_summary = cleanString(next.ghostwritten.about_summary);
  next.ghostwritten.features_copy = normalizeStringArray(next.ghostwritten.features_copy);
  next.ghostwritten.faqs = Array.isArray(next.ghostwritten.faqs)
    ? next.ghostwritten.faqs
    : [];

  return next;
}

/* --------------------------------
   HELPERS
-------------------------------- */

function normalizeStringArray(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map(function(item) {
      return cleanString(item);
    })
    .filter(Boolean);
}

function cloneValue(value) {
  if (Array.isArray(value) || isObject(value)) {
    return structuredClone(value);
  }
  return value;
}

function cleanString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function isObject(value) {
  return !!value && typeof value === "object" && !Array.isArray(value);
}