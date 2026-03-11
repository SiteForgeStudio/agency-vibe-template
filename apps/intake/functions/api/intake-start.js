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
    if (crypto.randomUUID) {
      return "intake_" + crypto.randomUUID();
    }
    return "intake_" + Date.now() + "_" + Math.random().toString(36).slice(2);
  }
  
  
  function cleanString(value) {
    if (typeof value !== "string") return "";
    return value.trim();
  }
  
  
  function buildInitialMessages() {
  
    const welcomeMessage = createAssistantMessage({
      id: crypto.randomUUID(),
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
      id: crypto.randomUUID(),
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
  
  
  export async function onRequestPost(context) {
  
    try {
  
      const body = await readJson(context.request);
  
      const businessName = cleanString(body.businessName);
      const clientEmail = cleanString(body.clientEmail);
  
      const sessionId = makeSessionId();
  
      const messages = buildInitialMessages();
  
      const state = JSON.parse(JSON.stringify(EMPTY_INTAKE_STATE));
  
      state.session_id = sessionId;
      state.phase = "identity";
      state.businessName = businessName;
      state.clientEmail = clientEmail;
      state.conversation = [...messages];
  
  
      if (businessName) {
  
        const nextQuestion = createAssistantMessage({
          id: crypto.randomUUID(),
          type: "question",
          content: "What made you decide you want a website right now?",
          options: [
            { label: "Help me write this", action: "ghostwrite" }
          ],
          meta: {
            intent: "capture_why_now",
            can_skip: true,
            can_ghostwrite: true
          }
        });
  
        state.phase = "intent";
  
        state.conversation = [
          messages[0],
          createAssistantMessage({
            id: crypto.randomUUID(),
            type: "transition",
            content: "Great — we’ll build around " + businessName + ".",
            options: [],
            meta: {
              intent: "acknowledge_business_name"
            }
          }),
          nextQuestion
        ];
  
        return json({
          ok: true,
          session_id: sessionId,
          phase: state.phase,
          messages: state.conversation,
          state
        });
  
      }
  
  
      return json({
        ok: true,
        session_id: sessionId,
        phase: state.phase,
        messages,
        state
      });
  
  
    } catch (error) {
  
      return json({
        ok: false,
        error: error.message || "Failed to start intake session"
      }, 500);
  
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