// api/send-otp.js
// Lives on Vercel only. Reads credentials from environment variables.
// Never hardcode MESSAGECENTRAL_AUTH_TOKEN or MESSAGECENTRAL_CUSTOMER_ID here.

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', 'https://marketerraja.com');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const CUSTOMER_ID = process.env.MESSAGECENTRAL_CUSTOMER_ID;
  const AUTH_TOKEN = process.env.MESSAGECENTRAL_AUTH_TOKEN;

  // --- Fail fast and clearly if env vars aren't actually set ---
  if (!CUSTOMER_ID || !AUTH_TOKEN) {
    return res.status(500).json({
      error: 'Server misconfigured: missing MESSAGECENTRAL_CUSTOMER_ID or MESSAGECENTRAL_AUTH_TOKEN in Vercel environment variables.',
      customerIdPresent: Boolean(CUSTOMER_ID),
      authTokenPresent: Boolean(AUTH_TOKEN),
      authTokenLength: AUTH_TOKEN ? AUTH_TOKEN.length : 0
    });
  }

  try {
    const { phone } = req.body || {};
    if (!phone || !/^\d{10}$/.test(phone)) {
      return res.status(400).json({ error: 'A valid 10-digit phone number is required' });
    }

    const sendUrl = `https://cpaas.messagecentral.com/verification/v3/send?countryCode=91&flowType=SMS&mobileNumber=${phone}&customerId=${CUSTOMER_ID}&otpLength=6`;

    const mcResponse = await fetch(sendUrl, {
      method: 'POST',
      headers: {
        'authToken': AUTH_TOKEN,
        'accept': '*/*'
      }
    });

    const rawText = await mcResponse.text();

    if (mcResponse.status === 401) {
      return res.status(502).json({
        error: 'Message Central rejected the auth token (401 Unauthorized).',
        hint: 'The token in MESSAGECENTRAL_AUTH_TOKEN does not match MESSAGECENTRAL_CUSTOMER_ID, is expired, or was pasted with extra whitespace/newline.',
        authTokenLength: AUTH_TOKEN.length,
        customerIdUsed: CUSTOMER_ID
      });
    }

    let result;
    try {
      result = JSON.parse(rawText);
    } catch {
      return res.status(502).json({
        error: 'Unexpected non-JSON response from Message Central',
        statusFromProvider: mcResponse.status,
        rawSnippet: rawText.slice(0, 300)
      });
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
    return res.status(500).json({ error: 'Internal server error', details: String(err) });
  }
}
