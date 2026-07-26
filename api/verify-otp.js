// api/verify-otp.js
// Lives on Vercel only. Reads credentials from environment variables.
// Never hardcode MESSAGECENTRAL_AUTH_TOKEN here.

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', 'https://marketerraja.com');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const AUTH_TOKEN = process.env.MESSAGECENTRAL_AUTH_TOKEN;

  if (!AUTH_TOKEN) {
    return res.status(500).json({
      error: 'Server misconfigured: missing MESSAGECENTRAL_AUTH_TOKEN in Vercel environment variables.'
    });
  }

  try {
    const { phone, code, verificationId } = req.body || {};
    if (!phone || !code || !verificationId) {
      return res.status(400).json({ error: 'phone, code, and verificationId are all required' });
    }

    const validateUrl = `https://cpaas.messagecentral.com/verification/v3/validateOtp?countryCode=91&mobileNumber=${phone}&verificationId=${verificationId}&code=${code}`;

    const mcResponse = await fetch(validateUrl, {
      method: 'GET',
      headers: {
        'authToken': AUTH_TOKEN,
        'accept': '*/*'
      }
    });

    const rawText = await mcResponse.text();

    if (mcResponse.status === 401) {
      return res.status(502).json({
        error: 'Message Central rejected the auth token (401 Unauthorized).',
        hint: 'The token in MESSAGECENTRAL_AUTH_TOKEN is invalid or expired.'
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

    if (result.responseCode === 200 && result.data.verificationStatus === 'VERIFICATION_COMPLETED') {
      return res.status(200).json({ success: true });
    } else {
      return res.status(400).json({ success: false, error: 'Invalid OTP' });
    }

  } catch (err) {
    console.error('Server error:', err);
    return res.status(500).json({ error: 'Internal server error', details: String(err) });
  }
}
