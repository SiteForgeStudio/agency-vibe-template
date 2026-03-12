// functions/api/intake-start.js
/**
 * intake-start.js
 *
 * SiteForge Factory — Conversational Intake Start Endpoint
 *
 * Location:
 * apps/intake/functions/api/intake-start.js
 *
 * Purpose:
 * - start a new intake session
 * - generate a session_id
 * - initialize intake state
 * - return first assistant messages
 */

import {
  EMPTY_INTAKE_STATE,
  createAssistantMessage
} from "./intake-prompts.js";

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json",
      "cache-control": "no-store"
    }
  });
}

async function readJson(request) {
  try {
    return await request.json();
  } catch {
    return {};
  }
}

function makeSessionId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return "intake_" + crypto.randomUUID();
  }
  return "intake_" + Date.now() + "_" + Math.random().toString(36).slice(2);
}

function makeId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return "msg_" + Date.now() + "_" + Math.random().toString(36).slice(2);
}

function cleanString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function cloneEmptyState() {
  return JSON.parse(JSON.stringify(EMPTY_INTAKE_STATE));
}

function buildInitialMessages() {
  const welcomeMessage = createAssistantMessage({
    id: makeId(),
    type: "welcome",
    content:
      "Let’s create a strong website direction for your business. I’ll guide you step by step, and if you're unsure how to say something, I can help write it with you.",
    options: [
      { label: "Let's start", action: "continue" },
      { label: "I want help writing", action: "continue" }
    ],
    meta: {
      intent: "welcome",
      can_skip: false,
      can_ghostwrite: true
    }
  });

  const questionMessage = createAssistantMessage({
    id: makeId(),
    type: "question",
    content: "What’s the name of your business?",
    options: [],
    meta: {
      intent: "capture_business_name",
      can_skip: false,
      can_ghostwrite: false
    }
  });

  return [welcomeMessage, questionMessage];
}

function buildKnownBusinessMessages(businessName) {
  const welcomeMessage = createAssistantMessage({
    id: makeId(),
    type: "welcome",
    content:
      "Let’s create a strong website direction for your business. I’ll guide you step by step, and if you're unsure how to say something, I can help write it with you.",
    options: [],
    meta: {
      intent: "welcome",
      can_skip: false,
      can_ghostwrite: true
    }
  });

  const transitionMessage = createAssistantMessage({
    id: makeId(),
    type: "transition",
    content: "Great — we’ll build around " + businessName + ".",
    options: [],
    meta: {
      intent: "acknowledge_business_name",
      can_skip: false,
      can_ghostwrite: false
    }
  });

  const purposeQuestion = createAssistantMessage({
    id: makeId(),
    type: "question",
    content:
      "What made you decide you want a website right now, or what should it help your business accomplish first?",
    options: [
      { label: "Get more leads", action: "continue" },
      { label: "Make booking easier", action: "continue" },
      { label: "Look more professional", action: "continue" }
    ],
    meta: {
      intent: "capture_business_purpose",
      can_skip: false,
      can_ghostwrite: true
    }
  });

  return [welcomeMessage, transitionMessage, purposeQuestion];
}

function buildSummaryPanel(state) {
  return {
    website_goal:
      cleanString(state.answers?.desired_outcome) ||
      cleanString(state.answers?.why_now),

    audience:
      cleanString(state.answers?.target_audience),

    offer:
      Array.isArray(state.answers?.offerings)
        ? state.answers.offerings.join(", ")
        : "",

    vibe:
      cleanString(state.inference?.suggested_vibe),

    cta:
      cleanString(state.answers?.primary_conversion_goal),

    components:
      Array.isArray(state.inference?.suggested_components)
        ? state.inference.suggested_components
        : [],

    service_area:
      cleanString(state.answers?.service_area) ||
      cleanString(state.answers?.office_address),

    contact_path:
      cleanString(state.clientEmail) ||
      cleanString(state.answers?.phone) ||
      cleanString(state.answers?.booking_url)
  };
}

function buildInitialReadiness() {
  return {
    score: 0,
    required_domains_complete: false,
    missing_domains: [
      "business_purpose_or_desired_outcome",
      "target_audience",
      "primary_offer",
      "cta_direction",
      "contact_path"
    ],
    can_generate_now: false
  };
}

export async function onRequestPost(context) {
  try {
    const body = await readJson(context.request);

    const businessName = cleanString(body.businessName);
    const clientEmail = cleanString(body.clientEmail);

    const sessionId = makeSessionId();
    const state = cloneEmptyState();

    state.session_id = sessionId;
    state.businessName = businessName;
    state.clientEmail = clientEmail;
    state.readiness = buildInitialReadiness();

    let messages;
    let phase;

    if (businessName) {
      phase = "intent";
      messages = buildKnownBusinessMessages(businessName);
    } else {
      phase = "identity";
      messages = buildInitialMessages();
    }

    state.phase = phase;
    state.conversation = messages.map(function(message) {
      return {
        role: message.role,
        content: message.content
      };
    });

    return json({
      ok: true,
      session_id: sessionId,
      phase: state.phase,
      messages,
      state,
      summary_panel: buildSummaryPanel(state)
    });
  } catch (error) {
    return json(
      {
        ok: false,
        error: error.message || "Failed to start intake session"
      },
      500
    );
  }
}

export async function onRequestGet() {
  return json({
    ok: true,
    endpoint: "intake-start",
    method: "POST",
    message: "Send a POST request to initialize a new intake session."
  });
}