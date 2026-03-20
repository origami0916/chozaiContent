// api/gas.js — Vercel Serverless Function
// Proxies requests to Google Apps Script, handling GAS's redirect quirks.
//
// GAS always responds with a 302 redirect. The actual JSON is at the redirect target.
// For POST requests, fetch's redirect:'follow' converts POST->GET, losing the body.
// So we: 1) send request with redirect:'manual' 2) grab Location header
// 3) GET that Location to retrieve the JSON response.

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const gasUrl = process.env.GAS_URL || req.query.gas_url || '';

  if (!gasUrl) {
    return res.status(400).json({ error: 'GAS_URL not configured' });
  }

  try {
    let finalUrl;

    if (req.method === 'GET') {
      const url = new URL(gasUrl);
      Object.entries(req.query).forEach(([k, v]) => {
        if (k !== 'gas_url') url.searchParams.set(k, v);
      });

      const r1 = await fetch(url.toString(), { redirect: 'manual' });

      if (r1.status >= 300 && r1.status < 400) {
        finalUrl = r1.headers.get('location');
      } else {
        const text = await r1.text();
        try { return res.status(200).json(JSON.parse(text)); }
        catch(e) { return res.status(500).json({ error: 'Non-JSON from GAS', body: text.substring(0, 200) }); }
      }

    } else if (req.method === 'POST') {
      const r1 = await fetch(gasUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify(req.body),
        redirect: 'manual'
      });

      if (r1.status >= 300 && r1.status < 400) {
        finalUrl = r1.headers.get('location');
      } else {
        const text = await r1.text();
        try { return res.status(200).json(JSON.parse(text)); }
        catch(e) { return res.status(500).json({ error: 'Non-JSON from GAS', body: text.substring(0, 200) }); }
      }

    } else {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    // Follow the redirect target
    if (finalUrl) {
      const r2 = await fetch(finalUrl, { redirect: 'follow' });
      const text = await r2.text();
      try { return res.status(200).json(JSON.parse(text)); }
      catch(e) { return res.status(500).json({ error: 'Redirect target non-JSON', body: text.substring(0, 200) }); }
    }

    return res.status(500).json({ error: 'No redirect URL from GAS' });

  } catch (err) {
    return res.status(500).json({ error: 'Proxy error: ' + err.message });
  }
}
