/**
 * apps/intake/functions/api/generate.js
 */
import { SYSTEM_RULES, VIBE_GUIDE, ICON_LIST } from './prompts.js';

// ... (Keep your MASTER_SCHEMA constant exactly as it is) ...

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
        const res = await fetch(APPS_SCRIPT_URL, {
            method: 'POST',
            mode: 'no-cors', // Apps Script requires no-cors for simple POST redirects
            body: JSON.stringify({
                factory_key: "forge_v4_secret", // Replace with your actual FACTORY_KEY
                business_json: currentJson,
                client_email: document.getElementById('email').value
            })
        });

        // With no-cors, we won't see the JSON body, but we can assume success if no error is thrown
        alert("Build Initialized! Your preview site will be ready in about 3-5 minutes. Check your email for the link.");
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

    // --- API POST LOGIC ---
    try {
      const { story, businessName, clientEmail } = await request.json();

      const strategyData = await callAI(env, {
        system: SYSTEM_RULES + VIBE_GUIDE,
        prompt: "Business: " + businessName + ". Story: " + story + ". Return intelligence, strategy, and vibe_selection.",
      });

      const fullContent = await callAI(env, {
        system: SYSTEM_RULES + "\nContext: Industry is " + strategyData.intelligence.industry + ", Vibe is " + strategyData.vibe_selection,
        prompt: "Generate complete business.json for: " + story + ". Create a URL-friendly 'slug' based on the business name and put it in the brand object.",
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
            slug: (businessName).toLowerCase().replace(/[^a-z0-9]/g, '-') // Force local slug safety
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
  // ... (Keep existing callAI logic) ...
}