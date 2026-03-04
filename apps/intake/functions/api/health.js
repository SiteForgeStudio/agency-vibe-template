export async function onRequestGet(context) {
    try {
      const now = new Date().toISOString();
  
      const response = {
        ok: true,
        service: "siteforge-intake",
        version: "1.0",
        timestamp: now,
        region: context?.cf?.colo || "unknown"
      };
  
      return new Response(JSON.stringify(response, null, 2), {
        status: 200,
        headers: {
          "content-type": "application/json; charset=utf-8",
          "cache-control": "no-store"
        }
      });
  
    } catch (err) {
      return new Response(JSON.stringify({
        ok: false,
        error: String(err)
      }), {
        status: 500,
        headers: { "content-type": "application/json" }
      });
    }
  }