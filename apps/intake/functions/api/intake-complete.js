/**
 * intake-complete.js
 *
 * SiteForge Factory — Conversational Intake Complete Endpoint
 *
 * Purpose:
 * - validate intake state
 * - synthesize strategy brief
 * - call existing /api/generate
 * - return business_json + slug
 */

export async function onRequestPost(context) {

    try {
  
      const body = await readJson(context.request);
  
      const sessionId = cleanString(body.session_id);
      const state = isObject(body.state) ? body.state : {};
      const force = Boolean(body.force);
  
      if (!sessionId) {
        return json({ ok:false, error:"Missing session_id" },400);
      }
  
      const businessName = cleanString(state.businessName);
      const clientEmail = cleanString(state.clientEmail);
  
      if (!businessName) {
        return json({ ok:false, error:"Missing businessName in state" },400);
      }
  
      const readiness = evaluateReadiness(state);
  
      if (!force && !readiness.can_generate_now) {
  
        return json({
          ok:false,
          error:"Intake not ready for generation",
          readiness,
          missing_domains:readiness.missing_domains
        },400);
  
      }
  
      const strategyBrief = synthesizeStrategyBrief(state);
  
      const generatePayload = {
        businessName,
        clientEmail,
        story: strategyBrief
      };
  
      const generateResponse = await callGenerateEndpoint({
        request:context.request,
        payload:generatePayload
      });
  
      return json({
        ok:true,
        session_id:sessionId,
        readiness,
        strategy_brief:strategyBrief,
        generated:generateResponse
      });
  
    } catch(err) {
  
      return json({
        ok:false,
        error:String(err.message || err)
      },500);
  
    }
  
  }
  
  
  export async function onRequestGet(){
  
    return json({
      ok:true,
      endpoint:"intake-complete",
      method:"POST"
    });
  
  }
  
  
  /* --------------------------------
     GENERATE HANDOFF
  -------------------------------- */
  
  async function callGenerateEndpoint({ request, payload }){
  
    const url = new URL(request.url);
  
    url.pathname = "/api/generate";
    url.search = "";
  
    const res = await fetch(url.toString(),{
      method:"POST",
      headers:{ "content-type":"application/json" },
      body:JSON.stringify(payload)
    });
  
    const text = await res.text();
  
    let data;
  
    try{
      data = JSON.parse(text);
    }catch{
      throw new Error("Generate endpoint returned non JSON");
    }
  
    if(!res.ok || !data.ok){
      throw new Error(data.error || "Generate endpoint failed");
    }
  
    return data;
  
  }
  
  
  /* --------------------------------
     STRATEGY BRIEF SYNTHESIS
  -------------------------------- */
  
  function synthesizeStrategyBrief(state){
  
    const name = cleanString(state.businessName) || "This business";
  
    const whyNow = cleanString(state.answers?.why_now);
    const desiredOutcome = cleanString(state.answers?.desired_outcome);
    const audience = cleanString(state.answers?.target_audience);
    const offer = cleanList(state.answers?.offerings);
    const differentiators = cleanList(state.answers?.differentiators);
    const trustSignals = cleanList(state.answers?.trust_signals);
    const credibility = cleanList(state.answers?.credibility_factors);
    const cta = cleanString(state.answers?.primary_conversion_goal);
    const vibe = cleanString(state.inference?.suggested_vibe);
  
    const parts = [];
  
    parts.push(name + " needs a premium conversion-focused website.");
  
    if(whyNow){
      parts.push("The site is being created now because " + whyNow + ".");
    }
  
    if(desiredOutcome){
      parts.push("The main goal of the site is to " + desiredOutcome + ".");
    }
  
    if(audience){
      parts.push("The site should attract " + audience + ".");
    }
  
    if(offer.length){
      parts.push("The business focuses on " + offer.join(", ") + ".");
    }
  
    if(differentiators.length){
      parts.push("The business stands out because of " + differentiators.join(", ") + ".");
    }
  
    const trust = [...trustSignals,...credibility];
  
    if(trust.length){
      parts.push("Trust should be reinforced through " + trust.join(", ") + ".");
    }
  
    if(cta){
      parts.push("The primary call to action should encourage visitors to " + cta + ".");
    }
  
    if(vibe){
      parts.push("The overall visual vibe should feel " + vibe + ".");
    }
  
    parts.push("Use this strategy brief to generate a polished 2026 website that feels premium and conversion-ready.");
  
    return parts.join(" ");
  
  }
  
  
  /* --------------------------------
     READINESS
  -------------------------------- */
  
  function evaluateReadiness(state){
  
    const missing = [];
  
    if(!cleanString(state.answers?.why_now)) missing.push("business_purpose");
    if(!cleanString(state.answers?.desired_outcome)) missing.push("desired_outcome");
    if(!cleanString(state.answers?.target_audience)) missing.push("target_audience");
  
    if(!Array.isArray(state.answers?.offerings) || !state.answers.offerings.length){
      missing.push("primary_offer");
    }
  
    if(!cleanString(state.answers?.primary_conversion_goal)){
      missing.push("cta_direction");
    }
  
    const diff = Array.isArray(state.answers?.differentiators) ? state.answers.differentiators.length : 0;
    const trust = Array.isArray(state.answers?.trust_signals) ? state.answers.trust_signals.length : 0;
    const cred = Array.isArray(state.answers?.credibility_factors) ? state.answers.credibility_factors.length : 0;
  
    if(diff + trust + cred === 0){
      missing.push("trust_or_differentiation");
    }
  
    const total = 6;
    const complete = total - missing.length;
  
    return {
      score:complete/total,
      required_domains_complete:missing.length===0,
      missing_domains:missing,
      can_generate_now:missing.length===0
    };
  
  }
  
  
  /* --------------------------------
     UTILITIES
  -------------------------------- */
  
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
  
  function cleanList(arr){
    if(!Array.isArray(arr)) return [];
    return arr.map(v=>cleanString(v)).filter(Boolean);
  }