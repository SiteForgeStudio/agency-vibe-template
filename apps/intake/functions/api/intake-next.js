/**
 * intake-next.js
 *
 * SiteForge Factory — Conversational Intake Next-Step Endpoint
 *
 * Location:
 * apps/intake/functions/api/intake-next.js
 *
 * Purpose:
 * - accept the latest client answer
 * - update intake state
 * - call the AI intake controller
 * - merge updates
 * - return the next assistant message
 */

import {
    EMPTY_INTAKE_STATE,
    INTAKE_REQUIRED_DOMAINS,
    INTAKE_CONTROLLER_SYSTEM_PROMPT,
    INTAKE_CONTROLLER_DEVELOPER_PROMPT,
    INTAKE_FALLBACK_QUESTION_MAP,
    buildIntakeControllerUserPrompt,
    createAssistantMessage
  } from "./intake-prompts.js";
  
  
  export async function onRequestPost(context) {
  
    try {
  
      const body = await readJson(context.request);
  
      const sessionId = cleanString(body.session_id);
      const latestAnswer = cleanString(body.answer);
      const incomingState = body.state || {};
  
      if (!sessionId) {
        return json({ ok:false, error:"Missing session_id" },400);
      }
  
      const state = mergeState(incomingState);
      state.session_id = sessionId;
  
      if (!Array.isArray(state.conversation)) {
        state.conversation = [];
      }
  
      if (latestAnswer) {
        state.conversation.push({
          id: makeId(),
          role: "user",
          type: "answer",
          content: latestAnswer
        });
      }
  
      if (state.phase === "identity" && !state.businessName) {
  
        state.businessName = latestAnswer;
        state.phase = "intent";
  
        const message = createAssistantMessage({
          id: makeId(),
          type: "question",
          content: "What made you decide you want a website right now?",
          options: [{ label:"Help me write this", action:"ghostwrite" }],
          meta: { intent:"capture_why_now" }
        });
  
        state.conversation.push(message);
  
        return json({
          ok:true,
          phase:state.phase,
          message,
          state
        });
  
      }
  
      const controller = await callController({
        env: context.env,
        state,
        latestUserMessage: latestAnswer
      });
  
      const safe = normalizeController(controller,state);
  
      applyUpdates(state,safe.state_updates);
  
      state.phase = safe.phase || state.phase;
  
      state.conversation.push(safe.message);
  
      refreshReadiness(state);
  
      return json({
        ok:true,
        action:safe.action,
        phase:state.phase,
        message:safe.message,
        summary_panel:buildSummaryPanel(state),
        readiness:state.readiness,
        state
      });
  
    } catch(err) {
  
      return json({
        ok:false,
        error:String(err.message || err)
      },500);
  
    }
  
  }
  
  
  export async function onRequestGet() {
    return json({
      ok:true,
      endpoint:"intake-next",
      method:"POST"
    });
  }
  
  
  /* -------------------------
     AI CONTROLLER
  ------------------------- */
  
  async function callController({ env, state, latestUserMessage }) {
  
    const model = env.OPENAI_MODEL || "gpt-4.1-mini";
  
    const system = INTAKE_CONTROLLER_SYSTEM_PROMPT + "\n\n" + INTAKE_CONTROLLER_DEVELOPER_PROMPT;
  
    const user = buildIntakeControllerUserPrompt({
      phase:state.phase,
      businessName:state.businessName,
      clientEmail:state.clientEmail,
      latestUserMessage,
      state,
      conversation:state.conversation.slice(-10)
    });
  
    const res = await fetch("https://api.openai.com/v1/responses",{
      method:"POST",
      headers:{
        "content-type":"application/json",
        "authorization":"Bearer "+env.OPENAI_API_KEY
      },
      body:JSON.stringify({
        model,
        input:[
          { role:"system", content:[{ type:"input_text", text:system }] },
          { role:"user", content:[{ type:"input_text", text:user }] }
        ]
      })
    });
  
    const data = await res.json();
  
    const text =
      data?.output?.[0]?.content?.find(c=>c.type==="output_text")?.text
      || data?.output_text;
  
    return JSON.parse(text);
  }
  
  
  /* -------------------------
     STATE MANAGEMENT
  ------------------------- */
  
  function mergeState(incoming) {
  
    const base = JSON.parse(JSON.stringify(EMPTY_INTAKE_STATE));
  
    if (!incoming) return base;
  
    return deepMerge(base,incoming);
  }
  
  
  function applyUpdates(state,updates) {
  
    if (!updates) return;
  
    for (const [key,val] of Object.entries(updates)) {
      state[key] = val;
    }
  
  }
  
  
  function refreshReadiness(state) {
  
    const missing = [];
  
    if (!state.answers?.why_now) missing.push("business_purpose");
    if (!state.answers?.desired_outcome) missing.push("desired_outcome");
    if (!state.answers?.target_audience) missing.push("target_audience");
  
    state.readiness = {
      score:(INTAKE_REQUIRED_DOMAINS.length-missing.length)/INTAKE_REQUIRED_DOMAINS.length,
      required_domains_complete:missing.length===0,
      missing_domains:missing,
      can_generate_now:missing.length===0
    };
  
  }
  
  
  /* -------------------------
     CONTROLLER NORMALIZATION
  ------------------------- */
  
  function normalizeController(raw,state){
  
    if(!raw || typeof raw!=="object"){
      return fallback(state);
    }
  
    if(!raw.message || !raw.message.content){
      return fallback(state);
    }
  
    return raw;
  }
  
  
  function fallback(state){
  
    const message = createAssistantMessage({
      id:makeId(),
      type:"question",
      content:INTAKE_FALLBACK_QUESTION_MAP.business_purpose,
      options:[{label:"Help me write this",action:"ghostwrite"}],
      meta:{intent:"fallback"}
    });
  
    return {
      action:"probe",
      phase:"intent",
      message,
      state_updates:{}
    };
  
  }
  
  
  /* -------------------------
     SUMMARY PANEL
  ------------------------- */
  
  function buildSummaryPanel(state){
  
    return {
      website_goal:state.answers?.desired_outcome || "",
      audience:state.answers?.target_audience || "",
      offer:(state.answers?.offerings || []).join(", "),
      vibe:state.inference?.suggested_vibe || "",
      components:state.inference?.suggested_components || [],
      cta:state.answers?.primary_conversion_goal || ""
    };
  
  }
  
  
  /* -------------------------
     UTILITIES
  ------------------------- */
  
  async function readJson(req){
    try { return await req.json(); }
    catch { return {}; }
  }
  
  function json(data,status=200){
    return new Response(JSON.stringify(data),{
      status,
      headers:{ "content-type":"application/json" }
    });
  }
  
  function cleanString(v){
    return typeof v==="string"?v.trim():"";
  }
  
  function makeId(){
    if(crypto.randomUUID) return crypto.randomUUID();
    return Date.now()+"_"+Math.random().toString(36).slice(2);
  }
  
  function deepMerge(target,source){
  
    for(const key in source){
  
      if(Array.isArray(source[key])){
        target[key]=source[key];
        continue;
      }
  
      if(typeof source[key]==="object"){
        if(!target[key]) target[key]={};
        deepMerge(target[key],source[key]);
        continue;
      }
  
      target[key]=source[key];
  
    }
  
    return target;
  
  }