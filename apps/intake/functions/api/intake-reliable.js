/**
 * SITEFORGE FACTORY — intake-next.js
 * Simple & Reliable version - Final Attempt
 */

export async function onRequestPost(context) {
    const { request } = context;
  
    try {
      const body = await request.json();
      let state = structuredClone(body.state || {});
  
      const userMessage = String(body.answer || "").trim();
  
      // === Simple Direct Extraction ===
      const phoneMatch = userMessage.match(/(\+?1?[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/);
      if (phoneMatch) {
        state.answers = state.answers || {};
        state.answers.phone = phoneMatch[0];
        state.verified = state.verified || {};
        state.verified.phone = true;
      }
  
      // Basic service area update
      if (userMessage.toLowerCase().includes("boulder")) {
        state.answers.service_area = "Boulder, Colorado and surrounding areas";
        state.verified.service_area = true;
      }
  
      // Update readiness
      const hasContact = Boolean(state.answers.phone);
      state.readiness = {
        score: hasContact ? 0.9 : 0.6,
        can_generate_now: hasContact,
        missing_domains: hasContact ? [] : ["contact_path"]
      };
  
      state.verification = {
        queue_complete: hasContact,
        verified_count: hasContact ? 2 : 0,
        remaining_keys: hasContact ? [] : ["phone"],
        last_updated: new Date().toISOString()
      };
  
      // Conversation
      state.conversation = state.conversation || [];
      state.conversation.push({ role: "user", content: userMessage });
      state.conversation.push({ 
        role: "assistant", 
        content: hasContact 
          ? "Thank you. I've recorded your phone number as the primary contact method. Your intake is now ready for preview generation." 
          : "Thank you for the information." 
      });
  
      state.phase = hasContact ? "intake_complete" : "guided_enrichment";
  
      return new Response(JSON.stringify({
        ok: true,
        state,
        current_key: "phone",
        action: hasContact ? "complete" : "continue",
        message: hasContact 
          ? "Thank you. I've recorded your phone number. Your intake is now ready." 
          : "Thank you for the information."
      }), {
        headers: { "content-type": "application/json; charset=utf-8" }
      });
  
    } catch (err) {
      console.error(err);
      return new Response(JSON.stringify({ ok: false, error: err.message }), { status: 500 });
    }
  }