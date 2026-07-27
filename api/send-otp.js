// api/send-otp.js
// POST { phone: "9876543210" }
// -> { success: true, verificationId: "..." }

const { getAuthToken } = require("./_lib/messageCentral");

// very basic in-memory rate limit per phone (resets on cold start — good enough to start with)
const lastSentAt = new Map();
const COOLDOWN_MS = 30 * 1000;

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*"); // tighten to your domain in production
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") {
    return res.status(405).json({ success: false, error: "Method not allowed" });
  }

  try {
    const { phone } = req.body || {};
    if (!phone || !/^\d{10}$/.test(phone)) {
      return res.status(400).json({ success: false, error: "Invalid phone number" });
    }

    const last = lastSentAt.get(phone);
    if (last && Date.now() - last < COOLDOWN_MS) {
      return res.status(429).json({ success: false, error: "Please wait before requesting another OTP" });
    }

    const token = await getAuthToken();

    // v3 endpoint — does NOT take customerId as a query param
    const url = `https://cpaas.messagecentral.com/verification/v3/send` +
      `?countryCode=91&flowType=SMS&mobileNumber=${encodeURIComponent(phone)}&otpLength=6`;

    const mcRes = await fetch(url, {
      method: "POST",
      headers: { authToken: token },
    });
    const mcRawText = await mcRes.text();

    let mcData;
    try {
      mcData = JSON.parse(mcRawText);
    } catch {
      return res.status(502).json({
        success: false,
        error: `Message Central send returned non-JSON (status ${mcRes.status}): ${mcRawText.slice(0, 300)}`,
      });
    }

    if (mcData.responseCode !== 200 || !mcData.data) {
      return res.status(502).json({
        success: false,
        error: "Message Central rejected the request",
        hint: mcData.message || mcData.data?.errorMessage || null,
      });
    }

    lastSentAt.set(phone, Date.now());

    return res.status(200).json({
      success: true,
      verificationId: mcData.data.verificationId,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, error: err.message });
  }
};
