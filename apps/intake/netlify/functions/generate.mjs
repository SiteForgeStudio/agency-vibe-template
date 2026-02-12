export default async () => {
    return new Response(JSON.stringify({ ok: true, message: "generate placeholder" }), {
      headers: { "content-type": "application/json" }
    });
  };
  