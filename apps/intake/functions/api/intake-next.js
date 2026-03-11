/**
 * intake-next.js
 *
 * SiteForge Factory — Conversational Intake Step
 */

import {
  INTAKE_CONTROLLER_SYSTEM_PROMPT,
  INTAKE_CONTROLLER_DEVELOPER_PROMPT,
  buildIntakeControllerUserPrompt,
  EMPTY_INTAKE_STATE
} from "./intake-prompts.js";

export async function onRequestPost(context) {

  try {

    const body = await readJson(context.request);

    const sessionId = cleanString(body.session_id);
    const answer = cleanString(body.answer);
    const uiAction = cleanString(body.ui_action);
    const state = isObject(body.state) ? body.state : structuredClone(EMPTY_INTAKE_STATE);

    if (!sessionId) {
      return json({ ok:false, error:"Missing session_id" },400);
    }

    if (!answer && !uiAction) {
      return json({ ok:false, error:"Missing answer or ui_action" },400);
    }

    const latestUserMessage = answer || uiAction;

    const userPrompt = buildIntakeControllerUserPrompt({
      phase: state.phase || "unknown",
      businessName: state.businessName,
      clientEmail: state.clientEmail,
      latestUserMessage,
      state,
      conversation: state.conversation || []
    });

    const controllerResponse = await callController(context.env,userPrompt);

    const mergedState = mergeState(state,controllerResponse.state_updates);

    mergedState.phase = controllerResponse.phase || mergedState.phase;

    mergedState.conversation = mergedState.conversation || [];

    mergedState.conversation.push({
      role:"user",
      content:latestUserMessage
    });

    if (controllerResponse.message) {
      mergedState.conversation.push({
        role:"assistant",
        content:controllerResponse.message.content
      });
    }

    const readiness = evaluateReadiness(mergedState);

    mergedState.readiness = readiness;

    return json({
      ok:true,
      phase:mergedState.phase,
      message:controllerResponse.message,
      state:mergedState,
      readiness,
      action:controllerResponse.action,
      summary_panel:buildSummaryPanel(mergedState)
    });

  } catch(err) {

    return json({
      ok:false,
      error:String(err.message || err)
    },500);

  }

}


/* =========================
   OpenAI Controller Call
========================= */

async function callController(env,userPrompt){

  const apiKey = env.OPENAI_API_KEY;
  const model = env.OPENAI_MODEL || "gpt-4.1";

  const res = await fetch("https://api.openai.com/v1/chat/completions",{

    method:"POST",

    headers:{
      "content-type":"application/json",
      "authorization":"Bearer " + apiKey
    },

    body:JSON.stringify({

      model,

      temperature:0.4,

      messages:[
        { role:"system", content:INTAKE_CONTROLLER_SYSTEM_PROMPT },
        { role:"system", content:INTAKE_CONTROLLER_DEVELOPER_PROMPT },
        { role:"user", content:userPrompt }
      ]

    })

  });

  const jsonRes = await res.json();

  const content = jsonRes.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error("Controller returned empty response");
  }

  let parsed;

  try{
    parsed = JSON.parse(content);
  }catch{
    throw new Error("Controller returned invalid JSON");
  }

  return parsed;

}


/* =========================
   Merge State
========================= */

function mergeState(existing,updates){

  if (!isObject(updates)) return existing;

  const next = structuredClone(existing);

  Object.keys(updates).forEach(key=>{

    const val = updates[key];

    if (isObject(val) && isObject(next[key])) {
      next[key] = { ...next[key], ...val };
    } else {
      next[key] = val;
    }

  });

  return next;

}


/* =========================
   Readiness
========================= */

function evaluateReadiness(state){

  const whyNow = cleanString(state.answers?.why_now);
  const desiredOutcome = cleanString(state.answers?.desired_outcome);
  const audience = cleanString(state.answers?.target_audience);

  const hasOffer =
    Array.isArray(state.answers?.offerings) &&
    state.answers.offerings.length > 0;

  const scoreParts = [
    Boolean(whyNow || desiredOutcome),
    Boolean(audience),
    Boolean(hasOffer)
  ];

  const score = scoreParts.filter(Boolean).length / scoreParts.length;

  return {
    score,
    can_generate_now:Boolean(whyNow || desiredOutcome)
  };

}


/* =========================
   Summary Panel
========================= */

function buildSummaryPanel(state){

  return {

    website_goal:
      cleanString(state.answers?.desired_outcome),

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
      state.inference?.suggested_components || []

  };

}


/* =========================
   Utilities
========================= */

async function readJson(req){
  try{ return await req.json(); }
  catch{ return {}; }
}

function json(data,status=200){
  return new Response(JSON.stringify(data),{
    status,
    headers:{
      "content-type":"application/json",
      "cache-control":"no-store"
    }
  });
}

function cleanString(v){
  return typeof v==="string" ? v.trim() : "";
}

function isObject(v){
  return v && typeof v==="object" && !Array.isArray(v);
}