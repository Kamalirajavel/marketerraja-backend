// This file lives on Vercel, NOT on your GitHub Pages site.
// AUTH_TOKEN and CUSTOMER_ID are read from Vercel environment variables —
// they never appear in this file or in any code served to the browser.

export default async function handler(req, res) {
  // --- CORS: allow your live site to call this function ---
  res.setHeader('Access-Control-Allow-Origin', 'https://marketerraja.com');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { phone } = req.body;

    if (!phone || !/^\d{10}$/.test(phone)) {
      return res.status(400).json({ error: 'A valid 10-digit phone number is required' });
    }

    const CUSTOMER_ID = process.env.MESSAGECENTRAL_CUSTOMER_ID;
    const AUTH_TOKEN = process.env.MESSAGECENTRAL_AUTH_TOKEN;

    const sendUrl = `https://cpaas.messagecentral.com/verification/v3/send?countryCode=91&flowType=SMS&mobileNumber=${phone}&customerId=${CUSTOMER_ID}&otpLength=6`;

    const mcResponse = await fetch(sendUrl, {
      method: 'POST',
      headers: {
        'authToken': AUTH_TOKEN,
        'accept': '*/*'
      }
    });

    const rawText = await mcResponse.text();
    let result;
    try {
      result = JSON.parse(rawText);
    } catch {
      console.error('Non-JSON response from Message Central:', rawText);
      return res.status(502).json({ error: 'Unexpected response from OTP provider' });
    }

    if (mcResponse.status === 401) {
      console.error('Message Central auth failed — check env vars');
      return res.status(502).json({ error: 'OTP provider authentication failed' });
    }

    if (result.responseCode === 200 || result.status === 'SUCCESS') {
      return res.status(200).json({
        success: true,
        verificationId: result.data.verificationId
      });
    } else {
      return res.status(400).json({ error: result.message || 'Failed to send OTP' });
    }

  } catch (err) {
    console.error('Server error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
