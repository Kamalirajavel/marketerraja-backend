// api/_lib/messageCentral.js
// Shared helper: fetches + caches the Message Central auth token.
// Reused by both send-otp.js and verify-otp.js.

const CUSTOMER_ID = process.env.MC_CUSTOMER_ID;
const MC_KEY = process.env.MC_KEY; // base64-encoded password, from Message Central dashboard
const MC_EMAIL = process.env.MC_EMAIL || "you@marketerraja.com";

// Cached in memory for the lifetime of the serverless instance (cold start = refetch).
// Token is valid for ~30 days per Message Central docs, so this avoids refetching every request.
let cachedToken = null;
let cachedAt = 0;
const TOKEN_TTL_MS = 25 * 24 * 60 * 60 * 1000; // refresh a bit before the real 30-day expiry

async function getAuthToken() {
  const isFresh = cachedToken && (Date.now() - cachedAt) < TOKEN_TTL_MS;
  if (isFresh) return cachedToken;

  if (!CUSTOMER_ID || !MC_KEY) {
    throw new Error("Missing MC_CUSTOMER_ID or MC_KEY environment variables");
  }

  const url = `https://cpaas.messagecentral.com/auth/v1/authentication/token` +
    `?customerId=${encodeURIComponent(CUSTOMER_ID)}` +
    `&key=${encodeURIComponent(MC_KEY)}` +
    `&scope=NEW&country=91&email=${encodeURIComponent(MC_EMAIL)}`;

  const res = await fetch(url, { headers: { accept: "*/*" } });
  const rawText = await res.text();

  let data;
  try {
    data = JSON.parse(rawText);
  } catch {
    throw new Error(
      `Message Central returned non-JSON (status ${res.status}): ${rawText.slice(0, 300)}`
    );
  }

  if (!data.token) {
    throw new Error(`Failed to get auth token: ${JSON.stringify(data)}`);
  }

  cachedToken = data.token;
  cachedAt = Date.now();
  return cachedToken;
}

module.exports = { getAuthToken, CUSTOMER_ID };
