// api/verify-otp.js
// POST { code: "1234", verificationId: "..." }
// -> { success: true } or { success: false, error: "..." }

const { getAuthToken } = require("./_lib/messageCentral");

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*"); // tighten to your domain in production
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") {
    return res.status(405).json({ success: false, error: "Method not allowed" });
  }

  try {
    const { code, verificationId } = req.body || {};
    if (!code || !verificationId) {
      return res.status(400).json({ success: false, error: "Missing code or verificationId" });
    }

    const token = await getAuthToken();

    // v3 endpoint
    const url = `https://cpaas.messagecentral.com/verification/v3/validateOtp` +
      `?verificationId=${encodeURIComponent(verificationId)}&code=${encodeURIComponent(code)}`;

    const mcRes = await fetch(url, {
      method: "GET",
      headers: { authToken: token },
    });
    const mcRawText = await mcRes.text();

    let mcData;
    try {
      mcData = JSON.parse(mcRawText);
    } catch {
      return res.status(502).json({
        success: false,
        error: `Message Central validate returned non-JSON (status ${mcRes.status}): ${mcRawText.slice(0, 300)}`,
      });
    }

    const verified = mcData.responseCode === 200 &&
      mcData.data?.verificationStatus === "VERIFICATION_COMPLETED";

    if (verified) {
      return res.status(200).json({ success: true });
    }

    return res.status(200).json({
      success: false,
      error: mcData.data?.verificationStatus === "EXPIRED"
        ? "OTP expired, please request a new one"
        : "Incorrect OTP",
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, error: err.message });
  }
};
