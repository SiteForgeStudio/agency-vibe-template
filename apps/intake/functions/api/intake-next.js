/**
 * SITEFORGE FACTORY — intake-next.js
 * Deterministic verification/refinement engine
 *
 * Rules:
 * - intake-start.js remains the free -> paid bridge
 * - strategy_contract is the source of queue/readiness intent
 * - code owns mutation, readiness, queue, and current_key
 * - no updates object
 * - no ghostwritten_updates
 * - no model-controlled mutation
 */

export async function onRequestPost(context) {
  const { request } = context;

  try {
    const body = await request.json();
    let state = normalizeState(structuredClone(body.state || {}));
    const userMessage = cleanString(body.answer || "");

    if (!state.provenance?.strategy_contract) {
      throw new Error("Missing strategy_contract - run intake-start first");
    }

    state.meta = state.meta || {};
    state.meta.verified = isObject(state.meta.verified) ? state.meta.verified : {};
    state.meta.seeded = isObject(state.meta.seeded) ? state.meta.seeded : {};
    state.meta.inferred = isObject(state.meta.inferred) ? state.meta.inferred : {};

    state.answers = isObject(state.answers) ? state.answers : {};
    state.conversation = Array.isArray(state.conversation) ? state.conversation : [];

    const currentKeyBefore = state.current_key || selectNextVerificationKey(state);

    if (userMessage && currentKeyBefore) {
      extractObviousSignals(state, userMessage);
      applyDeterministicAnswer(state, currentKeyBefore, userMessage);
      sanitizeAnswers(state);

      state.conversation.push({
        role: "user",
        content: userMessage
      });
    }

    state.verification = recomputeVerificationQueue(state);
    state.readiness = evaluateReadiness(state);

    const nextKey = selectNextVerificationKey(state);
    state.current_key = nextKey;
    state.phase = state.readiness.can_generate_now ? "intake_complete" : "guided_enrichment";
    state.action = state.readiness.can_generate_now ? "complete" : "continue";

    const assistantMessage = nextKey
      ? buildQuestionForKey(state, nextKey)
      : "Excellent — we have enough verified detail to generate the preview direction now.";

    state.conversation.push({
      role: "assistant",
      content: assistantMessage
    });

    return json({
      ok: true,
      state,
      current_key: nextKey,
      action: state.action,
      message: assistantMessage
    });
  } catch (err) {
    console.error("[intake-next]", err);
    return json({ ok: false, error: err.message }, 500);
  }
}

/* --------------------------------
   CORE FLOW
-------------------------------- */

function applyDeterministicAnswer(state, key, rawInput) {
  const canonicalKey = canonicalizeKey(key);
  const targetPath = getAnswerPathForKey(canonicalKey);
  if (!targetPath) return;

  const extracted = extractAnswerForKey(canonicalKey, rawInput);
  if (!hasMeaningfulValue(extracted)) {
    return;
  }

  setByPath(state, targetPath, extracted);

  const answerField = targetPath.replace(/^answers\./, "");
  state.verified[answerField] = true;
  state.meta.verified[answerField] = true;

  if (state.meta.seeded[answerField] == null) {
    state.meta.seeded[answerField] = hasMeaningfulValue(getByPath(state, targetPath));
  }
}

function selectNextVerificationKey(state) {
  const verification = recomputeVerificationQueue(state);
  return verification.remaining_keys[0] || null;
}

function recomputeVerificationQueue(state) {
  const contract = state.provenance.strategy_contract || {};
  const requirements = contract.content_requirements || {};

  const mustVerifyNow = cleanList(requirements.must_verify_now);
  const previewRequired = cleanList(requirements.preview_required_fields);

  const orderedRaw = [
    ...mustVerifyNow,
    ...previewRequired
  ];

  const ordered = uniqueList(
    orderedRaw
      .map(canonicalizeKey)
      .filter((key) => !!getAnswerPathForKey(key))
  );

  const remaining = ordered.filter((key) => !isKeySatisfied(state, key));

  return {
    queue_complete: remaining.length === 0,
    verified_count: ordered.length - remaining.length,
    remaining_keys: remaining,
    last_updated: new Date().toISOString()
  };
}

function evaluateReadiness(state) {
  const contract = state.provenance.strategy_contract || {};
  const requirements = contract.content_requirements || {};

  const previewRequired = uniqueList(
    cleanList(requirements.preview_required_fields)
      .map(canonicalizeKey)
      .filter((key) => !!getAnswerPathForKey(key))
  );

  const publishRequired = uniqueList(
    cleanList(requirements.publish_required_fields)
      .map(canonicalizeKey)
      .filter((key) => !!getAnswerPathForKey(key))
  );

  const previewMissing = previewRequired.filter((key) => !isKeySatisfied(state, key));
  const publishMissing = publishRequired.filter((key) => !isKeySatisfied(state, key));

  const total = Math.max(previewRequired.length, 1);
  const completeCount = previewRequired.length - previewMissing.length;
  const score = Number((completeCount / total).toFixed(2));

  return {
    score,
    can_generate_now: previewMissing.length === 0,
    missing_domains: previewMissing,
    publish_missing: publishMissing
  };
}

/* --------------------------------
   QUESTION ENGINE
-------------------------------- */

function buildQuestionForKey(state, key) {
  const canonicalKey = canonicalizeKey(key);
  const contract = state.provenance.strategy_contract || {};

  const businessName =
    cleanString(state.businessName) ||
    cleanString(contract.business_context?.business_name) ||
    "your business";

  const category = cleanString(contract.business_context?.category);
  const serviceArea = cleanString(
    Array.isArray(contract.business_context?.service_area)
      ? contract.business_context.service_area[0]
      : ""
  );
  const primaryConversion = cleanString(contract.conversion_strategy?.primary_conversion);

  switch (canonicalKey) {
    case "service area specifics":
      return `We already have ${serviceArea || "your core area"} as the base for ${businessName}. To make the preview feel accurate, do you serve all nearby areas or only specific neighborhoods, towns, or parts of the region?`;

    case "pricing structure":
      return `For a ${category || "service"} like this, pricing clarity affects trust fast. Do you price by project size, window count, home size, package, or custom quote?`;

    case "booking_method":
      return `When someone is ready to ${primaryConversion || "take the next step"}, what should happen first — call, text, form submission, or something else?`;

    case "availability for peak seasons":
      return `Are there busy seasons, lead-time expectations, or scheduling limits we should set clearly so the site feels honest and well-managed?`;

    case "primary_offer":
      return `We have a starting offer from preflight, but I want to tighten it. What is the main service or result you most want this site to sell first?`;

    case "service_area":
      return `What is the cleanest way to describe your service area on the site — a city, a county, a metro area, or a list of towns?`;

    case "phone":
      return `What public phone number should appear on the site for inquiries or quote requests?`;

    case "booking_url":
      return `Do you already have a booking page, request form, or external link we should send people to?`;

    case "hours":
      return `What hours or availability window should we show publicly on the site?`;

    case "business address":
      return `Do you want to show a public business address, or should we present this as a service-area business without a storefront address?`;

    case "photos":
      return `Do you already have strong project photos we can use later, especially before-and-after or finished-work images?`;

    case "customer testimonials":
      return `Do you already have customer testimonials or review quotes we can use to build trust on the page?`;

    case "detailed service descriptions":
      return `What are the main service types or packages you want described clearly on the page?`;

    case "founder bio":
      return `Would you like the site to include a founder or owner story, and if so, what should it emphasize?`;

    default:
      return `Let’s tighten one more important detail for the preview. Can you clarify: ${canonicalKey}?`;
  }
}

/* --------------------------------
   SATISFACTION + MAPPING
-------------------------------- */

function isKeySatisfied(state, key) {
  const canonicalKey = canonicalizeKey(key);
  const targetPath = getAnswerPathForKey(canonicalKey);

  if (!targetPath) {
    return false;
  }

  const value = getByPath(state, targetPath);
  return hasMeaningfulValue(value);
}

function getAnswerPathForKey(key) {
  const normalized = normalizeKey(key);

  const map = {
    "primary_offer": "answers.primary_offer",
    "booking_method": "answers.booking_method",
    "service_area": "answers.service_area",
    "service area specifics": "answers.service_area_specifics",
    "pricing structure": "answers.pricing_structure",
    "availability for peak seasons": "answers.peak_season_availability",
    "phone": "answers.phone",
    "booking_url": "answers.booking_url",
    "hours": "answers.hours",
    "business address": "answers.office_address",
    "description": "answers.business_description",
    "photos": "answers.photos_status",
    "detailed service descriptions": "answers.service_descriptions",
    "customer testimonials": "answers.testimonials_status",
    "founder bio": "answers.founder_bio"
  };

  return map[normalized] || null;
}

function canonicalizeKey(key) {
  const normalized = normalizeKey(key);

  const canonicalMap = {
    "booking process": "booking_method",
    "public business phone number": "phone",
    "hours of operation": "hours",
    "address": "business address",
    "high-quality photos of previous work": "photos"
  };

  return canonicalMap[normalized] || normalized;
}

/* --------------------------------
   EXTRACTION
-------------------------------- */

function extractObviousSignals(state, input) {
  const text = cleanString(input);
  if (!text) return;

  const phoneMatch = text.match(/(?:\+?1[\s.\-]?)?(?:\(?\d{3}\)?[\s.\-]?)\d{3}[\s.\-]?\d{4}/);
  if (phoneMatch && !hasMeaningfulValue(state.answers.phone)) {
    state.answers.phone = normalizePhone(phoneMatch[0]);
    state.meta.inferred.phone = true;
  }

  if (!hasMeaningfulValue(state.answers.booking_method)) {
    if (/\bcall\b/i.test(text)) {
      state.answers.booking_method = "call";
      state.meta.inferred.booking_method = true;
    } else if (/\btext\b/i.test(text)) {
      state.answers.booking_method = "text";
      state.meta.inferred.booking_method = true;
    } else if (/\bform\b|\bcontact form\b|\bsubmit\b/i.test(text)) {
      state.answers.booking_method = "form";
      state.meta.inferred.booking_method = true;
    }
  }
}

function extractAnswerForKey(key, rawInput) {
  const canonicalKey = canonicalizeKey(key);
  const input = collapseWhitespace(rawInput);

  const sentences = input
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);

  const joined = (matches) => matches.join(" ").trim();

  switch (canonicalKey) {
    case "service area specifics": {
      const matches = sentences.filter((s) =>
        /\bserve\b|\bservice area\b|\bcounty\b|\bcity\b|\btown\b|\btowns\b|\bneighborhood\b|\bneighborhoods\b|\bregion\b|\bnearby\b|\barea\b/i.test(s)
      );
      return joined(matches);
    }

    case "pricing structure": {
      const matches = sentences.filter((s) =>
        /\bprice\b|\bpricing\b|\bquote\b|\bcost\b|\brate\b|\bestimate\b|\bwindow count\b|\bhome size\b|\bcustom\b/i.test(s)
      );
      return joined(matches);
    }

    case "booking_method": {
      const matches = sentences.filter((s) =>
        /\bcall\b|\btext\b|\bform\b|\bcontact\b|\brequest\b|\bbook\b/i.test(s)
      );
      if (!matches.length) return "";

      const text = joined(matches);
      if (/\bcall\b/i.test(text)) return "call";
      if (/\btext\b/i.test(text)) return "text";
      if (/\bform\b|\bcontact form\b/i.test(text)) return "form";
      return text;
    }

    case "availability for peak seasons": {
      const matches = sentences.filter((s) =>
        /\bseason\b|\bbusiest\b|\bbusy\b|\blead time\b|\bavailability\b|\bspring\b|\bsummer\b|\bfall\b|\bwinter\b|\bweek\b|\bweeks\b/i.test(s)
      );
      return joined(matches);
    }

    case "phone": {
      const match = input.match(/(?:\+?1[\s.\-]?)?(?:\(?\d{3}\)?[\s.\-]?)\d{3}[\s.\-]?\d{4}/);
      return match ? normalizePhone(match[0]) : "";
    }

    case "booking_url": {
      const match = input.match(/(https?:\/\/[^\s]+|www\.[^\s]+|[a-z0-9-]+\.[a-z]{2,}[^\s]*)/i);
      return match ? match[0] : "";
    }

    default:
      return input;
  }
}

/* --------------------------------
   SANITIZING
-------------------------------- */

function sanitizeAnswers(state) {
  const a = state.answers || {};
  const verified = state.meta?.verified || {};

  if (hasMeaningfulValue(a.service_area_specifics) && a.service_area_specifics.length < 4) {
    a.service_area_specifics = "";
    delete verified.service_area_specifics;
    delete state.verified.service_area_specifics;
  }

  if (hasMeaningfulValue(a.pricing_structure) && a.pricing_structure.length < 4) {
    a.pricing_structure = "";
    delete verified.pricing_structure;
    delete state.verified.pricing_structure;
  }

  if (a.booking_method && !["call", "text", "form"].includes(normalizeKey(a.booking_method))) {
    a.booking_method = collapseWhitespace(a.booking_method);
  }
}

/* --------------------------------
   STATE NORMALIZATION
-------------------------------- */

function normalizeState(state) {
  const next = isObject(state) ? state : {};

  next.answers = isObject(next.answers) ? next.answers : {};
  next.ghostwritten = isObject(next.ghostwritten) ? next.ghostwritten : {};
  next.verified = isObject(next.verified) ? next.verified : {};
  next.verification = isObject(next.verification) ? next.verification : {};
  next.readiness = isObject(next.readiness) ? next.readiness : {};
  next.provenance = isObject(next.provenance) ? next.provenance : {};
  next.meta = isObject(next.meta) ? next.meta : {};

  next.meta.verified = isObject(next.meta.verified) ? next.meta.verified : {};
  next.meta.seeded = isObject(next.meta.seeded) ? next.meta.seeded : {};
  next.meta.inferred = isObject(next.meta.inferred) ? next.meta.inferred : {};

  next.conversation = Array.isArray(next.conversation) ? next.conversation : [];
  next.phase = cleanString(next.phase) || "guided_enrichment";
  next.action = cleanString(next.action) || "continue";

  return next;
}

/* --------------------------------
   UTILITIES
-------------------------------- */

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store"
    }
  });
}

function cleanString(v) {
  return typeof v === "string" ? v.trim() : "";
}

function cleanList(arr) {
  if (!Array.isArray(arr)) return [];
  return arr.map(cleanString).filter(Boolean);
}

function uniqueList(arr) {
  return Array.from(new Set(arr));
}

function isObject(v) {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

function normalizeKey(v) {
  return cleanString(v).toLowerCase();
}

function collapseWhitespace(str) {
  return cleanString(str).replace(/\s+/g, " ").trim();
}

function hasMeaningfulValue(value) {
  if (Array.isArray(value)) return value.length > 0;
  return cleanString(value) !== "";
}

function getByPath(obj, path) {
  return path.split(".").reduce((acc, part) => {
    if (acc == null) return undefined;
    return acc[part];
  }, obj);
}

function setByPath(obj, path, value) {
  const parts = path.split(".");
  const last = parts.pop();

  let ref = obj;
  for (const part of parts) {
    if (!isObject(ref[part])) ref[part] = {};
    ref = ref[part];
  }

  ref[last] = value;
}

function normalizePhone(input) {
  const digits = input.replace(/\D/g, "");

  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }

  if (digits.length === 11 && digits.startsWith("1")) {
    const d = digits.slice(1);
    return `+1 (${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
  }

  return input;
}