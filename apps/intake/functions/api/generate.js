/**
 * apps/intake/functions/api/generate.js
 * 100/100 Astro/Tailwind Data-Driven Engine
 */
import { SYSTEM_RULES, VIBE_GUIDE, ICON_LIST } from './prompts.js';

const MASTER_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["intelligence", "strategy", "settings", "brand", "hero", "about", "features", "contact", "gallery"],
  properties: {
    intelligence: { 
      type: "object", 
      additionalProperties: false,
      required: ["industry", "target_persona", "tone_of_voice"], 
      properties: { 
        industry: { type: "string" }, 
        target_persona: { type: "string" }, 
        tone_of_voice: { type: "string" } 
      } 
    },
    strategy: { 
      type: "object", 
      additionalProperties: false,
      required: ["show_trustbar", "show_about", "show_features", "show_events", "show_process", "show_testimonials", "show_gallery", "show_investment", "show_faqs", "show_service_area"],
      properties: { 
        show_trustbar: { type: "boolean" }, 
        show_about: { type: "boolean" }, 
        show_features: { type: "boolean" }, 
        show_events: { type: "boolean" }, 
        show_process: { type: "boolean" }, 
        show_testimonials: { type: "boolean" }, 
        show_gallery: { type: "boolean" }, 
        show_investment: { type: "boolean" }, 
        show_faqs: { type: "boolean" }, 
        show_service_area: { type: "boolean" } 
      } 
    },
    settings: { 
      type: "object", 
      additionalProperties: false,
      required: ["vibe", "menu", "cta_text", "cta_link", "cta_type"], 
      properties: { 
        vibe: { type: "string" }, 
        cta_text: { type: "string" }, 
        cta_link: { type: "string" }, 
        cta_type: { type: "string" }, 
        menu: { 
          type: "array", 
          items: { 
            type: "object", 
            additionalProperties: false,
            required: ["label", "path"],
            properties: { label: { type: "string" }, path: { type: "string" } } 
          } 
        } 
      } 
    },
    brand: { 
      type: "object", 
      additionalProperties: false,
      required: ["name", "tagline", "email", "phone", "objection_handle", "slug"], 
      properties: { 
        name: { type: "string" }, 
        tagline: { type: "string" }, 
        email: { type: "string" }, 
        phone: { type: "string" }, 
        objection_handle: { type: "string" },
        slug: { type: "string" }
      } 
    },
    hero: { 
      type: "object", 
      additionalProperties: false,
      required: ["headline", "subtext", "image"], 
      properties: { 
        headline: { type: "string" }, 
        subtext: { type: "string" }, 
        image: { 
          type: "object", 
          additionalProperties: false,
          required: ["alt", "image_search_query"], 
          properties: { alt: { type: "string" }, image_search_query: { type: "string" } } 
        } 
      } 
    },
    about: { 
      type: "object", 
      additionalProperties: false,
      required: ["story_text", "founder_note", "years_experience"], 
      properties: { 
        story_text: { type: "string" }, 
        founder_note: { type: "string" }, 
        years_experience: { type: "string" } 
      } 
    },
    features: { 
      type: "array", 
      items: { 
        type: "object", 
        additionalProperties: false,
        required: ["title", "description", "icon_slug"], 
        properties: { title: { type: "string" }, description: { type: "string" }, icon_slug: { type: "string" } } 
      } 
    },
    gallery: {
      type: "object",
      additionalProperties: false,
      required: ["enabled", "computed_layout", "computed_count", "image_source"],
      properties: {
        enabled: { type: "boolean" },
        computed_layout: { type: "string" },
        computed_count: { type: "number" },
        image_source: {
          type: "object",
          additionalProperties: false,
          required: ["image_search_query"],
          properties: { image_search_query: { type: "string" } }
        }
      }
    },
    contact: { 
      type: "object", 
      additionalProperties: false,
      required: ["headline", "subheadline", "email_recipient", "button_text"], 
      properties: { 
        headline: { type: "string" }, 
        subheadline: { type: "string" }, 
        email_recipient: { type: "string" }, 
        button_text: { type: "string" } 
      } 
    }
  }
};

export default {
  async fetch(request, env) {
    if (request.method === "GET") {
      const html = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
          <meta charset="UTF-8"><title>Vibe-Engine Intake</title>
          <script src="https://cdn.tailwindcss.com"></script>
          <style>body { background:#0a0a0a; color:#f5f5f5; } .glass { background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.1); backdrop-filter:blur(10px); }</style>
      </head>
      <body class="min-h-screen flex items-center justify-center p-6">
          <div id="main-card" class="max-w-2xl w-full glass p-8 rounded-2xl shadow-2xl">
              <h1 class="text-3xl font-bold bg-gradient-to-r from-blue-400 to-emerald-400 bg-clip-text text-transparent mb-6">Start Your Build</h1>
              <div id="form-fields" class="space-y-4">
                  <input type="text" id="bizName" placeholder="Business Name" class="w-full bg-black/50 border border-white/10 rounded p-3">
                  <textarea id="story" rows="5" placeholder="Tell the business story..." class="w-full bg-black/50 border border-white/10 rounded p-3"></textarea>
                  <input type="email" id="email" placeholder="Email" class="w-full bg-black/50 border border-white/10 rounded p-3">
                  <button onclick="runAI()" class="w-full py-4 bg-white text-black font-bold rounded hover:bg-blue-400 transition-all">Generate Strategy</button>
              </div>
              <div id="review-area" class="hidden space-y-4 mt-6 border-t border-white/10 pt-6">
                  <h2 class="text-xl font-bold">Your Strategy is Ready</h2>
                  <p id="vibe-reveal" class="text-blue-400 font-mono"></p>
                  <p id="tagline-reveal" class="italic text-gray-400"></p>
                  <button onclick="submitToFactory()" class="w-full py-4 bg-emerald-500 text-white font-bold rounded hover:bg-emerald-600 transition-all">Launch Preview Site</button>
              </div>
          </div>
          <div id="loading" class="hidden fixed inset-0 bg-black/90 flex flex-col items-center justify-center z-50">
            <div class="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4"></div>
            <p id="load-text" class="text-white">AI is ghostwriting...</p>
          </div>
          <script>
              let currentJson = null;
              const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwQw94D-AuT0voHa9jsiLH9YP3dKqmQPs1fUkU5iOiodDoAS3GkOHL-o3CqM8KS02Bh/exec';

              async function runAI() {
                  document.getElementById('loading').classList.remove('hidden');
                  try {
                      const res = await fetch('/', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ businessName: document.getElementById('bizName').value, story: document.getElementById('story').value, clientEmail: document.getElementById('email').value })
                      });
                      currentJson = await res.json();
                      
                      document.getElementById('form-fields').classList.add('opacity-50', 'pointer-events-none');
                      document.getElementById('review-area').classList.remove('hidden');
                      document.getElementById('vibe-reveal').innerText = "Vibe: " + currentJson.settings.vibe;
                      document.getElementById('tagline-reveal').innerText = '"' + currentJson.brand.tagline + '"';
                  } catch (e) { alert(e.message); }
                  finally { document.getElementById('loading').classList.add('hidden'); }
              }

              async function submitToFactory() {
                  if (!currentJson) return;
                  const submitBtn = document.querySelector('button[onclick="submitToFactory()"]');
                  document.getElementById('load-text').innerText = "Initializing Factory Build...";
                  document.getElementById('loading').classList.remove('hidden');
                  submitBtn.disabled = true;

                  try {
                      await fetch(APPS_SCRIPT_URL, {
                          method: 'POST',
                          mode: 'no-cors',
                          body: JSON.stringify({
                              factory_key: "forge_v4_secret",
                              business_json: currentJson,
                              client_email: document.getElementById('email').value
                          })
                      });
                      alert("Build Initialized! Your preview site will be ready in 3-5 minutes.");
                      window.location.reload();
                  } catch (e) {
                      alert("Submission Error: " + e.message);
                      submitBtn.disabled = false;
                  } finally {
                      document.getElementById('loading').classList.add('hidden');
                  }
              }
          </script>
      </body></html>`;
      return new Response(html, { headers: { "Content-Type": "text/html" } });
    }

    try {
      const { story, businessName, clientEmail } = await request.json();

      // PASS 1: Strategy & Vibe
      const strategyData = await callAI(env, {
        system: SYSTEM_RULES + VIBE_GUIDE,
        prompt: "Business: " + businessName + ". Story: " + story + ". Return intelligence, strategy, and vibe_selection.",
      });

      // PASS 2: Full Content with Gallery Logic
      const fullContent = await callAI(env, {
        system: SYSTEM_RULES + "\nContext: Industry is " + strategyData.intelligence.industry + ", Vibe is " + strategyData.vibe_selection,
        prompt: "Generate complete business.json for: " + story + ". Ensure you follow the GALLERY LOGIC for count and layout. Create a clean slug for the brand object.",
        schema: MASTER_SCHEMA
      });

      const finalResult = {
        ...strategyData,
        ...fullContent,
        settings: { ...fullContent.settings, vibe: strategyData.vibe_selection },
        brand: { 
            ...fullContent.brand, 
            name: businessName, 
            email: clientEmail || fullContent.brand.email,
            slug: (businessName).toLowerCase().replace(/[^a-z0-9]/g, '-')
        }
      };

      return new Response(JSON.stringify(finalResult), {
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
      });
    } catch (err) {
      return new Response(JSON.stringify({ error: err.message }), { status: 500 });
    }
  }
};

async function callAI(env, { system, prompt, schema }) {
  const body = {
    model: "gpt-4o",
    messages: [{ role: "system", content: system }, { role: "user", content: prompt }],
    temperature: 0.7
  };
  if (schema) {
    body.response_format = { type: "json_schema", json_schema: { name: "business_json", strict: true, schema: schema } };
  } else {
    body.response_format = { type: "json_object" };
  }

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Authorization": "Bearer " + env.OPENAI_API_KEY, "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });

  const json = await res.json();
  if (json.error) throw new Error(json.error.message);
  return JSON.parse(json.choices[0].message.content);
}