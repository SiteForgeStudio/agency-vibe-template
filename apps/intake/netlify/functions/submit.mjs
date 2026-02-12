export default async () => {
    return new Response(JSON.stringify({ ok: true, message: "submit placeholder" }), {
      headers: { "content-type": "application/json" }
    });
  };  