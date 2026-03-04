await fetch('/api/submit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      business_json: result.business_json,
      client_email: payload.clientEmail
    })
  });