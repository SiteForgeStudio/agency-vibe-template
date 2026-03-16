export async function onRequest(context) {
    const { request, env } = context;
  
    if (request.method !== "POST") {
      return new Response(JSON.stringify({ ok:false,error:"POST required"}),{status:405});
    }
  
    try {
  
      const body = await request.json();
      const slug = String(body.slug || "").trim();
  
      if(!slug){
        return new Response(JSON.stringify({ok:false,error:"Missing slug"}),{status:400});
      }
  
      const statusRes = await fetch(
        new URL("/api/preflight-status", request.url),
        {
          method:"POST",
          headers:{ "content-type":"application/json"},
          body:JSON.stringify({slug})
        }
      );
  
      const status = await statusRes.json();
  
      if(!status.ok){
        return new Response(JSON.stringify(status),{status:404});
      }
  
      const prompt = `
  You are a business strategist.
  
  Business:
  ${status.input_business_name}
  
  Location:
  ${status.city_or_service_area_input}
  
  Description:
  ${status.description_input}
  
  Infer:
  
  1. Business category
  2. Business model (service-area, storefront, hybrid)
  3. Buyer decision factors
  4. Trust signals customers expect
  5. Conversion goal
  6. Website section recommendations
  
  Return JSON:
  {
   entity_profile:{},
   buyer_intelligence:{},
   preflight_strategy:{}
  }
  `;
  
      const aiRes = await fetch("https://api.openai.com/v1/chat/completions",{
        method:"POST",
        headers:{
          "Authorization":`Bearer ${env.OPENAI_API_KEY}`,
          "Content-Type":"application/json"
        },
        body:JSON.stringify({
          model:"gpt-4o-mini",
          messages:[
            {role:"system",content:"Return only JSON"},
            {role:"user",content:prompt}
          ]
        })
      });
  
      const aiJson = await aiRes.json();
      const text = aiJson.choices?.[0]?.message?.content || "{}";
      const parsed = JSON.parse(text);
  
      const appsScriptPayload = {
        route:"preflight_recon",
        factory_key:env.FACTORY_KEY,
        slug,
        entity_profile:parsed.entity_profile,
        buyer_intelligence:parsed.buyer_intelligence,
        preflight_strategy:parsed.preflight_strategy
      };
  
      const res = await fetch(env.APPS_SCRIPT_WEBAPP_URL,{
        method:"POST",
        headers:{ "content-type":"application/json"},
        body:JSON.stringify(appsScriptPayload)
      });
  
      const result = await res.text();
  
      return new Response(result,{
        status:200,
        headers:{ "content-type":"application/json"}
      });
  
    } catch(err){
      return new Response(JSON.stringify({ok:false,error:String(err)}),{status:500});
    }
  }