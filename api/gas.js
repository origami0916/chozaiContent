// api/gas.js — Vercel Serverless Function
// Proxies requests to Google Apps Script to avoid CORS issues.
// The GAS_URL is stored as a Vercel environment variable, or passed as a query param on first setup.

export default async function handler(req, res) {
  // Allow CORS from any origin (since this is our own proxy)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // GAS URL: from env variable or from query param
  const gasUrl = process.env.GAS_URL || req.query.gas_url || '';

  if (!gasUrl) {
    return res.status(400).json({ error: 'GAS_URL not configured. Set it in Vercel Environment Variables or pass ?gas_url=...' });
  }

  try {
    if (req.method === 'GET') {
      // Forward GET request to GAS
      const url = new URL(gasUrl);
      // Forward all query params except gas_url
      Object.entries(req.query).forEach(([k, v]) => {
        if (k !== 'gas_url') url.searchParams.set(k, v);
      });
      
      const response = await fetch(url.toString(), { redirect: 'follow' });
      const data = await response.json();
      return res.status(200).json(data);

    } else if (req.method === 'POST') {
      // Forward POST request to GAS
      const response = await fetch(gasUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify(req.body),
        redirect: 'follow'
      });
      const data = await response.json();
      return res.status(200).json(data);
    }

    return res.status(405).json({ error: 'Method not allowed' });

  } catch (err) {
    return res.status(500).json({ error: 'GAS proxy error: ' + err.message });
  }
}
