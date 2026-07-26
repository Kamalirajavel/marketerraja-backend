// This file lives on Vercel, NOT on GitHub Pages.
// The Brevo API key is read from an environment variable set in the
// Vercel dashboard — it never appears in this file or in any code
// served to the browser.

export default async function handler(req, res) {
  // --- CORS: allow your GitHub Pages / custom domain to call this function ---
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
    const { title, bccList, liveBlogUrl } = req.body;

    if (!title || !Array.isArray(bccList)) {
      return res.status(400).json({ error: 'Missing required fields: title, bccList' });
    }

    const emailPayload = {
      sender: { name: "Marketer Raja", email: "marketerraja11@gmail.com" },
      to: [{ email: "marketerraja11@gmail.com", name: "Marketer Raja" }],
      bcc: bccList,
      subject: `New Growth Insight: ${title}`,
      htmlContent: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #000c24; color: #e8f4ff; padding: 30px; border: 1px solid #00f5ff; border-radius: 8px;">
          <h2 style="color: #00f5ff; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 20px;">Marketer Raja Intel</h2>
          <p style="font-size: 16px; line-height: 1.6;">We just dropped a brand new tactical breakdown on the blog:</p>
          <h3 style="color: #ff0080; font-size: 22px; margin: 20px 0;">${title}</h3>
          <p style="font-size: 14px; color: #a0c0ff; margin-bottom: 30px;">Tap the link below to deploy these strategies in your business immediately.</p>
          <a href="${liveBlogUrl || 'https://marketerraja.com/blog.html'}" style="display: inline-block; background: #00f5ff; color: #000c24; padding: 14px 28px; text-decoration: none; font-weight: bold; text-transform: uppercase; letter-spacing: 1px; border-radius: 4px;">Read the Protocol</a>
        </div>
      `
    };

    const brevoResponse = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "accept": "application/json",
        "api-key": process.env.BREVO_API_KEY, // <-- read from Vercel env var, never hardcoded
        "content-type": "application/json"
      },
      body: JSON.stringify(emailPayload)
    });

    const data = await brevoResponse.json().catch(() => ({}));

    if (!brevoResponse.ok) {
      console.error("Brevo error:", data);
      return res.status(brevoResponse.status).json({ error: 'Brevo request failed', details: data });
    }

    return res.status(200).json({ success: true, data });

  } catch (err) {
    console.error("Server error:", err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
